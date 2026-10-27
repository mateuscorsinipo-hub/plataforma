import { aiAvailability, getAIProvider } from "@/lib/ai";
import { loadLearnerContext } from "@/lib/ai/learner";
import { parseAttachments, runTutorTurn, titleFromMessage, type Attachment, type ChatStreamEvent } from "@/lib/ai/tutor/chat";
import { aiErrorMessages } from "@/lib/ai/types";
import { checkSameOrigin, jsonError, readJson, requireApiStudent } from "@/lib/api/guard";
import { getPlanForUser, getUserTimezone } from "@/lib/billing/entitlements";
import { listConversationSources } from "@/lib/data/tutor";
import { getReadyFiles } from "@/lib/data/files";
import { logger } from "@/lib/logger";
import { checkRateLimit, rateLimits } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { chatRequestSchema } from "@/lib/validation/ai";

export const maxDuration = 300;

export async function POST(request: Request) {
  const blocked = checkSameOrigin(request);
  if (blocked) return blocked;
  const auth = await requireApiStudent();
  if (!auth.ok) return auth.response;
  const { user, profile } = auth.ctx;

  if (!aiAvailability().available) return jsonError(503, aiErrorMessages.not_configured, { code: "not_configured" });
  if (!(await checkRateLimit(`chat:${user.id}`, rateLimits.aiChat))) {
    return jsonError(429, "Muitas mensagens em pouco tempo. Aguarde alguns segundos.");
  }

  let body: unknown;
  try {
    body = await readJson(request, 64 * 1024);
  } catch {
    return jsonError(400, "Requisição inválida.");
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const input = parsed.data;
  if (!input.regenerate && !input.message && !input.imageFileIds.length) return jsonError(400, "Escreva uma mensagem.");
  if (input.regenerate && !input.conversationId) return jsonError(400, "Conversa não informada.");

  const supabase = await createSupabaseServerClient();
  const [plan, timezone, learner] = await Promise.all([getPlanForUser(user.id), getUserTimezone(user.id), loadLearnerContext(profile)]);

  // Conversa ------------------------------------------------------------------------
  let conversation: { id: string; title: string; summary: string | null; isNew: boolean };
  if (input.conversationId) {
    const { data } = await supabase.from("ai_conversations").select("id, title, summary").eq("id", input.conversationId).maybeSingle();
    if (!data) return jsonError(404, "Conversa não encontrada.");
    conversation = { ...data, isNew: false };
  } else {
    const title = titleFromMessage(input.message || "Imagem enviada");
    const { data, error } = await supabase.from("ai_conversations").insert({ user_id: user.id, title }).select("id, title, summary").single();
    if (error || !data) {
      logger.error("tutor.conversation_create_failed", { code: error?.code ?? "unknown" });
      return jsonError(500, "Não foi possível iniciar a conversa.");
    }
    conversation = { ...data, isNew: true };
  }

  // Fontes (documentos processados) -----------------------------------------------------
  if (input.sourceFileIds.length) {
    const ids = [...new Set(input.sourceFileIds)];
    const files = (await getReadyFiles(ids)).filter((file) => file.purpose === "study");
    if (files.length !== ids.length) return jsonError(404, "Algum documento escolhido não está pronto para uso.");
    const current = await listConversationSources(conversation.id);
    const total = new Set([...current.map((f) => f.id), ...ids]).size;
    if (total > plan.maxSourcesPerSession) {
      return jsonError(400, `O plano ${plan.name} permite até ${plan.maxSourcesPerSession} documentos por conversa.`);
    }
    const { error } = await supabase
      .from("ai_conversation_sources")
      .upsert(ids.map((fileId) => ({ conversation_id: conversation.id, file_id: fileId, user_id: user.id })), { ignoreDuplicates: true });
    if (error) return jsonError(500, "Não foi possível anexar os documentos.");
  }
  const sources = await listConversationSources(conversation.id);

  // Pergunta ------------------------------------------------------------------------------
  let question: { id: string; content: string; attachments: Attachment[] };
  if (input.regenerate) {
    const { data: messages } = await supabase
      .from("ai_messages")
      .select("id, role, content, attachments, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(20);
    const lastUser = (messages ?? []).find((m) => m.role === "user");
    if (!lastUser) return jsonError(400, "Não há pergunta para responder de novo.");
    const after = (messages ?? []).filter((m) => m.role === "assistant" && m.created_at > lastUser.created_at).map((m) => m.id);
    if (after.length) await supabase.from("ai_messages").delete().in("id", after);
    question = { id: lastUser.id, content: lastUser.content, attachments: parseAttachments(lastUser.attachments) };
  } else {
    let attachments: Attachment[] = [];
    if (input.imageFileIds.length) {
      if (!getAIProvider().supportsImages) return jsonError(422, "O tutor desta instalação não lê imagens.");
      const ids = [...new Set(input.imageFileIds)];
      const files = (await getReadyFiles(ids)).filter((file) => file.purpose === "chat" && file.kind === "image");
      if (files.length !== ids.length) return jsonError(404, "Alguma imagem não terminou de ser enviada.");
      attachments = files.map((file) => ({ fileId: file.id, name: file.name, mimeType: file.mimeType }));
    }
    const { data, error } = await supabase
      .from("ai_messages")
      .insert({ conversation_id: conversation.id, user_id: user.id, role: "user", content: input.message, attachments })
      .select("id")
      .single();
    if (error || !data) return jsonError(500, "Não foi possível enviar a mensagem.");
    question = { id: data.id, content: input.message, attachments };
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // Conexão encerrada pelo navegador: a resposta parcial continua sendo salva.
        }
      };
      try {
        for await (const event of runTutorTurn({
          userId: user.id,
          plan,
          timezone,
          learner,
          conversation,
          question,
          sources,
          signal: request.signal,
        })) {
          send(event);
        }
      } catch (error) {
        logger.error("tutor.route_exception", { name: error instanceof Error ? error.name : "unknown" });
        send({ type: "error", code: "unexpected", message: aiErrorMessages.provider_error });
      } finally {
        try {
          controller.close();
        } catch {
          // já fechado
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
