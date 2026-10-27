"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { aiAvailability, getAIProvider } from "@/lib/ai";
import { aiTasks } from "@/lib/ai/config";
import { SUMMARY_SYSTEM } from "@/lib/ai/prompts/tutor";
import { parseAttachments } from "@/lib/ai/tutor/chat";
import { AIError, aiErrorMessages } from "@/lib/ai/types";
import { requireUser } from "@/lib/auth/session";
import { annotateUsage, consumeFeature, getPlanForUser, getUserTimezone, refundUsage } from "@/lib/billing/entitlements";
import { getReadyFiles } from "@/lib/data/files";
import { listConversationSources } from "@/lib/data/tutor";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";

/**
 * As ações não recarregam a rota: o chat atualiza o próprio estado com o resultado
 * (recarregar remontaria a conversa criada nesta mesma visita).
 */
type Result = { ok: true } | { ok: false; error: string };

const titleSchema = z.string().trim().min(1, "Dê um nome à conversa.").max(120, "Use no máximo 120 caracteres.");

export async function renameConversation(id: string, title: string): Promise<Result> {
  await requireUser("/app/tutor");
  const parsedId = uuidSchema.safeParse(id);
  const parsedTitle = titleSchema.safeParse(title);
  if (!parsedId.success) return { ok: false, error: "Conversa inválida." };
  if (!parsedTitle.success) return { ok: false, error: parsedTitle.error.issues[0]?.message ?? "Nome inválido." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_conversations")
    .update({ title: parsedTitle.data })
    .eq("id", parsedId.data)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível renomear." };
  return { ok: true };
}

/** Exclui a conversa, as mensagens (cascata) e as imagens enviadas nela. */
export async function deleteConversation(id: string): Promise<Result> {
  const user = await requireUser("/app/tutor");
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "Conversa inválida." };
  const supabase = await createSupabaseServerClient();
  const { data: messages } = await supabase.from("ai_messages").select("attachments").eq("conversation_id", parsedId.data);
  const imageIds = [...new Set((messages ?? []).flatMap((m) => parseAttachments(m.attachments).map((a) => a.fileId)))];

  const { data: deleted, error } = await supabase.from("ai_conversations").delete().eq("id", parsedId.data).select("id").maybeSingle();
  if (error || !deleted) return { ok: false, error: "Não foi possível excluir a conversa." };

  if (imageIds.length) {
    const { data: files } = await supabase
      .from("uploaded_files")
      .select("id, storage_path")
      .in("id", imageIds)
      .eq("purpose", "chat")
      .eq("user_id", user.id);
    if (files?.length) {
      await supabase.from("uploaded_files").delete().in(
        "id",
        files.map((f) => f.id),
      );
      const { error: storageError } = await supabase.storage.from("uploads").remove(files.map((f) => f.storage_path));
      if (storageError) logger.warn("tutor.image_cleanup_failed", { name: storageError.name });
    }
  }
  redirect("/app/tutor?conversa-excluida=1");
}

export async function removeConversationSource(conversationId: string, fileId: string): Promise<Result> {
  await requireUser("/app/tutor");
  const c = uuidSchema.safeParse(conversationId);
  const f = uuidSchema.safeParse(fileId);
  if (!c.success || !f.success) return { ok: false, error: "Dados inválidos." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("ai_conversation_sources").delete().eq("conversation_id", c.data).eq("file_id", f.data);
  if (error) return { ok: false, error: "Não foi possível remover o documento." };
  return { ok: true };
}

export async function addConversationSources(conversationId: string, fileIds: string[]): Promise<Result> {
  const user = await requireUser("/app/tutor");
  const c = uuidSchema.safeParse(conversationId);
  const ids = z.array(uuidSchema).min(1).max(20).safeParse([...new Set(fileIds)]);
  if (!c.success || !ids.success) return { ok: false, error: "Dados inválidos." };
  const supabase = await createSupabaseServerClient();
  const { data: conversation } = await supabase.from("ai_conversations").select("id").eq("id", c.data).maybeSingle();
  if (!conversation) return { ok: false, error: "Conversa não encontrada." };
  const files = (await getReadyFiles(ids.data)).filter((file) => file.purpose === "study");
  if (files.length !== ids.data.length) return { ok: false, error: "Algum documento não está pronto para uso." };
  const plan = await getPlanForUser(user.id);
  const current = await listConversationSources(c.data);
  if (new Set([...current.map((f) => f.id), ...ids.data]).size > plan.maxSourcesPerSession) {
    return { ok: false, error: `O plano ${plan.name} permite até ${plan.maxSourcesPerSession} documentos por conversa.` };
  }
  const { error } = await supabase
    .from("ai_conversation_sources")
    .upsert(ids.data.map((fileId) => ({ conversation_id: c.data, file_id: fileId, user_id: user.id })), { ignoreDuplicates: true });
  if (error) return { ok: false, error: "Não foi possível anexar os documentos." };
  return { ok: true };
}

/** Resumo da conversa feito pela IA (conta como uma mensagem do tutor). */
export async function summarizeConversation(id: string): Promise<{ ok: true; summary: string } | { ok: false; error: string }> {
  const user = await requireUser("/app/tutor");
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "Conversa inválida." };
  if (!aiAvailability().available) return { ok: false, error: aiErrorMessages.not_configured };

  const supabase = await createSupabaseServerClient();
  const { data: messages } = await supabase
    .from("ai_messages")
    .select("role, content, status")
    .eq("conversation_id", parsedId.data)
    .neq("status", "error")
    .order("created_at", { ascending: true })
    .limit(200);
  const transcript = (messages ?? [])
    .filter((m) => m.content.trim())
    .map((m) => `${m.role === "user" ? "Estudante" : "Tutor"}: ${m.content}`)
    .join("\n\n");
  if (transcript.length < 40) return { ok: false, error: "Converse um pouco mais antes de pedir um resumo." };

  const [plan, timezone] = await Promise.all([getPlanForUser(user.id), getUserTimezone(user.id)]);
  const consumption = await consumeFeature({ userId: user.id, plan, feature: "ai_chat_message", timezone, metadata: { action: "summary" } });
  if (!consumption.ok) return { ok: false, error: "Você atingiu o limite de mensagens com o tutor neste período." };

  try {
    // Conversas muito longas: o começo e o fim carregam o contexto e as conclusões.
    const clipped = transcript.length > 60_000 ? `${transcript.slice(0, 20_000)}\n\n[…]\n\n${transcript.slice(-40_000)}` : transcript;
    const result = await getAIProvider().generateText({
      ...aiTasks.conversationSummary,
      system: SUMMARY_SYSTEM,
      prompt: `<conversa>\n${clipped}\n</conversa>\n\nResuma a conversa.`,
    });
    const summary = result.text.trim().slice(0, 8000);
    if (!summary) throw new AIError("invalid_output");
    await supabase.from("ai_conversations").update({ summary }).eq("id", parsedId.data);
    await annotateUsage(consumption.recordId, { input_tokens: result.usage.inputTokens, output_tokens: result.usage.outputTokens, model: result.model });
    return { ok: true, summary };
  } catch (error) {
    await refundUsage(consumption.recordId);
    const code = error instanceof AIError ? error.code : "provider_error";
    logger.error("tutor.summary_failed", { code });
    return { ok: false, error: aiErrorMessages[code] };
  }
}
