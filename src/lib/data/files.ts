import "server-only";

import { toFileSummary, type FileSummary } from "@/lib/documents/summary";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export { toFileSummary, type FileSummary };

/** Arquivos de estudo do usuário (RLS garante que só os próprios aparecem). */
export async function listStudyFiles(options: { limit?: number; folderId?: string | null } = {}): Promise<FileSummary[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("uploaded_files")
    .select("*")
    .eq("purpose", "study")
    .neq("status", "pending_upload")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);
  if (options.folderId) query = query.eq("folder_id", options.folderId);
  const { data } = await query;
  return (data ?? []).map(toFileSummary);
}

/** Confere que os arquivos existem, pertencem ao usuário e já foram processados. */
export async function getReadyFiles(ids: string[]): Promise<FileSummary[]> {
  if (!ids.length) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("uploaded_files").select("*").in("id", ids).eq("status", "ready");
  const byId = new Map((data ?? []).map((row) => [row.id, toFileSummary(row)]));
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}
