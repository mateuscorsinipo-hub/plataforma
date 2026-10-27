import "server-only";

import { parseStoredContent, type GenerationContent } from "@/lib/ai/studio/content";
import type { GenerationKind } from "@/lib/ai/studio/kinds";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type GenerationListItem = {
  id: string;
  kind: GenerationKind;
  title: string;
  status: "pending" | "completed" | "failed";
  createdAt: string;
  errorMessage: string | null;
};

export async function listGenerations(limit = 30): Promise<GenerationListItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("ai_generations")
    .select("id, kind, title, status, created_at, error_message")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    errorMessage: row.error_message,
  }));
}

export type GenerationDetail = GenerationListItem & {
  content: GenerationContent | null;
  markdown: string | null;
  params: Record<string, unknown>;
  sources: { id: string; name: string }[];
  folderId: string | null;
};

export async function getGeneration(id: string): Promise<GenerationDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase
    .from("ai_generations")
    .select("id, kind, title, status, created_at, error_message, content, content_markdown, params, folder_id")
    .eq("id", id)
    .maybeSingle();
  if (!row) return null;
  const { data: sources } = await supabase
    .from("ai_generation_sources")
    .select("file_id, uploaded_files(original_name)")
    .eq("generation_id", id);
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    errorMessage: row.error_message,
    content: parseStoredContent(row.content),
    markdown: row.content_markdown,
    params: row.params && typeof row.params === "object" && !Array.isArray(row.params) ? (row.params as Record<string, unknown>) : {},
    sources: (sources ?? []).map((s) => ({ id: s.file_id, name: s.uploaded_files?.original_name ?? "Arquivo removido" })),
    folderId: row.folder_id,
  };
}
