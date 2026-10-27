import "server-only";

import type { Citation } from "@/lib/ai/sources";
import { parseAttachments, type Attachment } from "@/lib/ai/tutor/chat";
import { toFileSummary, type FileSummary } from "@/lib/documents/summary";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ConversationListItem = { id: string; title: string; lastMessageAt: string };

export type ChatMessageView = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "error" | "cancelled";
  attachments: (Attachment & { url: string | null })[];
  citations: Citation[];
  errorCode: string | null;
  createdAt: string;
};

export async function listConversations(limit = 60): Promise<ConversationListItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("ai_conversations")
    .select("id, title, last_message_at")
    .order("last_message_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => ({ id: row.id, title: row.title, lastMessageAt: row.last_message_at }));
}

export async function listConversationSources(conversationId: string): Promise<FileSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("ai_conversation_sources")
    .select("created_at, uploaded_files(*)")
    .eq("conversation_id", conversationId)
    .order("created_at");
  return (data ?? []).flatMap((row) => (row.uploaded_files && row.uploaded_files.status === "ready" ? [toFileSummary(row.uploaded_files)] : []));
}

function parseCitations(value: unknown): Citation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const c = item as Record<string, unknown>;
    if (typeof c.n !== "number" || typeof c.fileId !== "string" || typeof c.fileName !== "string") return [];
    return [
      {
        n: c.n,
        fileId: c.fileId,
        fileName: c.fileName,
        pageStart: typeof c.pageStart === "number" ? c.pageStart : null,
        pageEnd: typeof c.pageEnd === "number" ? c.pageEnd : null,
        excerpt: typeof c.excerpt === "string" ? c.excerpt : "",
      },
    ];
  });
}

export async function getConversation(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data: conversation } = await supabase
    .from("ai_conversations")
    .select("id, title, summary, created_at, last_message_at")
    .eq("id", id)
    .maybeSingle();
  if (!conversation) return null;
  const [{ data: messages }, sources] = await Promise.all([
    supabase
      .from("ai_messages")
      .select("id, role, content, status, attachments, citations, error_code, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(400),
    listConversationSources(id),
  ]);
  // Miniaturas das imagens enviadas: URLs assinadas de curta duração (bucket privado).
  const attachmentIds = [...new Set((messages ?? []).flatMap((m) => parseAttachments(m.attachments).map((a) => a.fileId)))];
  const urls = new Map<string, string>();
  if (attachmentIds.length) {
    const { data: files } = await supabase.from("uploaded_files").select("id, storage_path").in("id", attachmentIds);
    const paths = (files ?? []).map((f) => f.storage_path);
    if (paths.length) {
      const { data: signed } = await supabase.storage.from("uploads").createSignedUrls(paths, 3600);
      const byPath = new Map((signed ?? []).flatMap((s) => (s.signedUrl && s.path ? [[s.path, s.signedUrl] as const] : [])));
      for (const file of files ?? []) {
        const url = byPath.get(file.storage_path);
        if (url) urls.set(file.id, url);
      }
    }
  }
  const views: ChatMessageView[] = (messages ?? []).map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    status: m.status as ChatMessageView["status"],
    attachments: parseAttachments(m.attachments).map((a) => ({ ...a, url: urls.get(a.fileId) ?? null })),
    citations: parseCitations(m.citations),
    errorCode: m.error_code,
    createdAt: m.created_at,
  }));
  return { conversation, messages: views, sources };
}
