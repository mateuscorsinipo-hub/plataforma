import "server-only";

import { contextBudget } from "@/lib/ai/config";
import type { SourceExcerpt } from "@/lib/ai/prompts/tutor";
import type { FileSummary } from "@/lib/documents/summary";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Transforma a pergunta numa busca por qualquer termo relevante (OU), em vez de todos (E). */
export function buildSearchQuery(question: string): string {
  const words = question
    .toLowerCase()
    .normalize("NFC")
    .match(/[\p{L}\p{N}]{3,}/gu);
  if (!words) return "";
  return [...new Set(words)].slice(0, 16).join(" or ");
}

/**
 * Trechos mais relevantes dos arquivos anexados. Sem resultado na busca textual
 * (perguntas genéricas como "resuma"), usa o começo de cada documento.
 */
export async function retrieveExcerpts(files: FileSummary[], question: string): Promise<SourceExcerpt[]> {
  if (!files.length) return [];
  const supabase = await createSupabaseServerClient();
  const names = new Map(files.map((file) => [file.id, file.name]));
  const fileIds = files.map((file) => file.id);

  type Row = { id: string; file_id: string; chunk_index: number; page_start: number | null; page_end: number | null; content: string };
  let rows: Row[] = [];
  const query = buildSearchQuery(question);
  if (query) {
    const { data } = await supabase.rpc("search_document_chunks", { p_file_ids: fileIds, p_query: query, p_limit: 16 });
    rows = data ?? [];
  }
  if (!rows.length) {
    const perFile = Math.max(2, Math.floor(8 / files.length));
    const { data } = await supabase
      .from("document_chunks")
      .select("id, file_id, chunk_index, page_start, page_end, content")
      .in("file_id", fileIds)
      .lt("chunk_index", perFile)
      .order("chunk_index");
    rows = data ?? [];
  }

  const excerpts: SourceExcerpt[] = [];
  let used = 0;
  for (const row of rows) {
    if (used + row.content.length > contextBudget.tutorSourceChars && excerpts.length) break;
    used += row.content.length;
    excerpts.push({
      n: excerpts.length + 1,
      fileId: row.file_id,
      fileName: names.get(row.file_id) ?? "Documento",
      pageStart: row.page_start,
      pageEnd: row.page_end,
      chunkId: row.id,
      content: row.content,
    });
  }
  return excerpts;
}

export type Citation = {
  n: number;
  fileId: string;
  fileName: string;
  pageStart: number | null;
  pageEnd: number | null;
  excerpt: string;
};

/** Só vira citação o número que o modelo realmente usou e que existe nas fontes enviadas. */
export function extractCitations(answer: string, sources: SourceExcerpt[]): Citation[] {
  const used = new Set<number>();
  for (const match of answer.matchAll(/\[(\d{1,2})\]/g)) used.add(Number(match[1]));
  return sources
    .filter((source) => used.has(source.n))
    .map((source) => ({
      n: source.n,
      fileId: source.fileId,
      fileName: source.fileName,
      pageStart: source.pageStart,
      pageEnd: source.pageEnd,
      excerpt: source.content.slice(0, 400),
    }));
}

/** Remove marcadores [n] de respostas antigas: a numeração muda a cada pergunta. */
export function stripCitationMarkers(text: string): string {
  return text.replace(/\s?(?:\[\d{1,2}\])+(?=[\s.,;:!?)]|$)/g, "");
}

/** Texto completo dos arquivos, na ordem, até o limite de caracteres do plano. */
export async function loadFullText(files: FileSummary[], maxChars: number): Promise<{ text: string; chars: number; truncated: boolean; parts: string[] }> {
  const supabase = await createSupabaseServerClient();
  const parts: string[] = [];
  let chars = 0;
  let truncated = false;
  for (const file of files) {
    const { data } = await supabase
      .from("document_chunks")
      .select("chunk_index, content")
      .eq("file_id", file.id)
      .order("chunk_index")
      .limit(5000);
    const chunks = data ?? [];
    let header = files.length > 1 ? `## Arquivo: ${file.name}\n\n` : "";
    for (const chunk of chunks) {
      if (chars + chunk.content.length > maxChars) {
        truncated = true;
        break;
      }
      parts.push(header + chunk.content);
      header = "";
      chars += chunk.content.length;
    }
    if (truncated) break;
  }
  return { text: parts.join("\n\n"), chars, truncated, parts };
}
