import "server-only";

import { getAIProvider } from "@/lib/ai";
import { aiTasks, contextBudget } from "@/lib/ai/config";
import type { LearnerContext } from "@/lib/ai/prompts/shared";
import { formatSourcesBlock, tutorSystemPrompt, type SourceExcerpt } from "@/lib/ai/prompts/tutor";
import { extractCitations, retrieveExcerpts, stripCitationMarkers, type Citation } from "@/lib/ai/sources";
import { AIError, aiErrorMessages, type ChatMessage, type ContentPart, type Usage } from "@/lib/ai/types";
import { annotateUsage, consumeFeature, refundUsage } from "@/lib/billing/entitlements";
import type { PlanDefinition } from "@/lib/config/plans";
import type { FileSummary } from "@/lib/documents/summary";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type MessageRow = Database["public"]["Tables"]["ai_messages"]["Row"];

export type Attachment = { fileId: string; name: string; mimeType: string };

export type ChatStreamEvent =
  | { type: "meta"; conversationId: string; userMessageId: string; title: string; isNew: boolean }
  | { type: "thinking" }
  | { type: "delta"; text: string }
  | { type: "done"; messageId: string; citations: Citation[]; remaining: number; limit: number }
  | { type: "error"; code: string; message: string; messageId?: string };

/** Título automático a partir da primeira pergunta (sem chamada extra ao modelo). */
export function titleFromMessage(message: string): string {
  const firstLine = message.replace(/\s+/g, " ").trim();
  if (!firstLine) return "Nova conversa";
  if (firstLine.length <= 60) return firstLine;
  const cut = firstLine.slice(0, 60);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 30 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

export function parseAttachments(value: Json): Attachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const { fileId, name, mimeType } = item as Record<string, unknown>;
    return typeof fileId === "string" && typeof name === "string" && typeof mimeType === "string" ? [{ fileId, name, mimeType }] : [];
  });
}

/**
 * Histórico dentro do orçamento de contexto, do mais recente para trás.
 * Mensagens com erro ficam de fora; respostas canceladas entram (o estudante viu o texto).
 */
export function buildHistory(rows: Pick<MessageRow, "role" | "content" | "status" | "attachments">[], budgetChars: number) {
  const usable = rows.filter((row) => row.status !== "error" && row.content.trim().length > 0);
  const picked: ChatMessage[] = [];
  let used = 0;
  let truncated = false;
  for (let i = usable.length - 1; i >= 0; i--) {
    const row = usable[i]!;
    const attachments = parseAttachments(row.attachments);
    const imageNote = attachments.length ? `\n\n[O estudante enviou ${attachments.length === 1 ? "uma imagem" : `${attachments.length} imagens`} nesta mensagem.]` : "";
    const content = row.role === "assistant" ? stripCitationMarkers(row.content) : row.content + imageNote;
    if (used + content.length > budgetChars && picked.length) {
      truncated = true;
      break;
    }
    used += content.length;
    picked.unshift({ role: row.role as "user" | "assistant", content });
  }
  // A API exige começar por uma mensagem do estudante.
  while (picked.length && picked[0]!.role !== "user") picked.shift();
  return { messages: mergeConsecutive(picked), truncated };
}

/** Une mensagens seguidas do mesmo papel (ex.: pergunta reenviada após erro). */
function mergeConsecutive(messages: ChatMessage[]): ChatMessage[] {
  const merged: ChatMessage[] = [];
  for (const message of messages) {
    const last = merged[merged.length - 1];
    if (last && last.role === message.role && typeof last.content === "string" && typeof message.content === "string") {
      last.content = `${last.content}\n\n${message.content}`;
    } else {
      merged.push({ ...message });
    }
  }
  return merged;
}

async function loadImages(attachments: Attachment[], userId: string): Promise<ContentPart[]> {
  if (!attachments.length) return [];
  const admin = createSupabaseAdminClient();
  const { data: files } = await admin
    .from("uploaded_files")
    .select("id, storage_path, mime_type, status")
    .eq("user_id", userId)
    .in(
      "id",
      attachments.map((a) => a.fileId),
    );
  const parts: ContentPart[] = [];
  for (const file of files ?? []) {
    if (file.status !== "ready" || file.mime_type !== "image/jpeg") continue;
    const { data } = await admin.storage.from("uploads").download(file.storage_path);
    if (!data) continue;
    parts.push({ type: "image", mediaType: "image/jpeg", base64: Buffer.from(await data.arrayBuffer()).toString("base64") });
  }
  return parts;
}

/**
 * Turno do tutor: reserva consumo, monta histórico + trechos das fontes, transmite a
 * resposta e grava o resultado (completo, cancelado com o texto parcial, ou erro).
 */
export async function* runTutorTurn(params: {
  userId: string;
  plan: PlanDefinition;
  timezone: string;
  learner: LearnerContext;
  conversation: { id: string; title: string; summary: string | null; isNew: boolean };
  question: { id: string; content: string; attachments: Attachment[] };
  sources: FileSummary[];
  signal: AbortSignal;
}): AsyncGenerator<ChatStreamEvent> {
  const supabase = await createSupabaseServerClient();
  const provider = getAIProvider();

  yield {
    type: "meta",
    conversationId: params.conversation.id,
    userMessageId: params.question.id,
    title: params.conversation.title,
    isNew: params.conversation.isNew,
  };

  const consumption = await consumeFeature({
    userId: params.userId,
    plan: params.plan,
    feature: "ai_chat_message",
    timezone: params.timezone,
    metadata: { conversation_id: params.conversation.id },
  });
  if (!consumption.ok) {
    yield {
      type: "error",
      code: "limit_reached",
      message: `Você usou as ${consumption.limit} mensagens com o tutor disponíveis ${consumption.window === "day" ? "hoje" : "neste mês"}. O limite renova no próximo período.`,
    };
    return;
  }

  // Histórico anterior à pergunta atual.
  const { data: rows } = await supabase
    .from("ai_messages")
    .select("id, role, content, status, attachments, created_at")
    .eq("conversation_id", params.conversation.id)
    .order("created_at", { ascending: true })
    .limit(400);
  const previous = (rows ?? []).filter((row) => row.id !== params.question.id);
  const history = buildHistory(previous, contextBudget.tutorHistoryChars);

  let excerpts: SourceExcerpt[] = [];
  if (params.sources.length) excerpts = await retrieveExcerpts(params.sources, params.question.content);

  const images = provider.supportsImages ? await loadImages(params.question.attachments, params.userId) : [];
  const questionText = params.question.content || "Explique o que aparece na imagem e me ajude a resolver.";
  const currentContent: ContentPart[] = [
    ...images,
    ...(params.sources.length ? [{ type: "text" as const, text: formatSourcesBlock(excerpts) }] : []),
    { type: "text", text: questionText },
  ];

  let text = "";
  let usage: Usage | null = null;
  let model = "";
  let failure: AIError | null = null;

  try {
    const stream = provider.streamChat({
      ...aiTasks.tutorChat,
      system: tutorSystemPrompt(params.learner, {
        hasSources: params.sources.length > 0,
        summary: history.truncated ? params.conversation.summary : null,
      }),
      messages: [...history.messages, { role: "user", content: currentContent }],
      signal: params.signal,
    });
    for await (const event of stream) {
      if (event.type === "thinking") yield { type: "thinking" };
      else if (event.type === "text") {
        text += event.text;
        yield { type: "delta", text: event.text };
      } else {
        usage = event.usage;
        model = event.model;
      }
    }
  } catch (error) {
    failure = error instanceof AIError ? error : new AIError("provider_error");
    if (failure.code !== "cancelled") logger.error("tutor.stream_failed", { code: failure.code });
  }

  const cancelled = failure?.code === "cancelled" || params.signal.aborted;
  const citations = extractCitations(text, excerpts);
  const status = failure ? (cancelled ? "cancelled" : "error") : "complete";

  // Sem nenhum texto entregue, o crédito volta para o estudante.
  if (!text.trim()) await refundUsage(consumption.recordId);

  const { data: saved } = await supabase
    .from("ai_messages")
    .insert({
      conversation_id: params.conversation.id,
      user_id: params.userId,
      role: "assistant",
      content: text.slice(0, 100_000),
      citations: citations as unknown as Json[],
      status,
      model: model || null,
      input_tokens: usage?.inputTokens ?? null,
      output_tokens: usage?.outputTokens ?? null,
      error_code: failure && !cancelled ? failure.code : null,
    })
    .select("id")
    .single();
  await supabase.from("ai_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", params.conversation.id);
  if (usage && text.trim()) {
    await annotateUsage(consumption.recordId, { input_tokens: usage.inputTokens, output_tokens: usage.outputTokens, model });
  }

  if (failure && !cancelled) {
    yield { type: "error", code: failure.code, message: aiErrorMessages[failure.code], messageId: saved?.id };
    return;
  }
  const used = text.trim() ? consumption.used : consumption.used - 1;
  yield { type: "done", messageId: saved?.id ?? "", citations, remaining: Math.max(0, consumption.limit - used), limit: consumption.limit };
}
