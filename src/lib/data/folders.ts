import "server-only";

import type { GenerationKind } from "@/lib/ai/studio/kinds";
import { toCardFromRow, type MaterialCard } from "@/lib/data/library";
import { toFileSummary, type FileSummary } from "@/lib/documents/summary";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FolderItemKind } from "@/lib/validation/materials";

export type FolderSummary = {
  id: string;
  name: string;
  color: string;
  subjectId: string | null;
  examDate: string | null;
  counts: Record<FolderItemKind, number>;
  total: number;
};

/** Pastas do usuário com a contagem de itens (função com RLS de cada tabela). */
export async function listFolders(): Promise<FolderSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("folder_summaries");
  return (data ?? []).map((f) => {
    const counts: Record<FolderItemKind, number> = {
      file: Number(f.files_count),
      generation: Number(f.generations_count),
      deck: Number(f.decks_count),
      quiz: Number(f.quizzes_count),
      conversation: Number(f.conversations_count),
      material: Number(f.saved_count),
    };
    return {
      id: f.id,
      name: f.name,
      color: f.color,
      subjectId: f.subject_id,
      examDate: f.exam_date,
      counts,
      total: Object.values(counts).reduce((sum, n) => sum + n, 0),
    };
  });
}

/** Lista curta para menus de "mover para pasta". */
export async function listFolderOptions(): Promise<{ id: string; name: string }[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("folders").select("id, name").order("name").limit(200);
  return data ?? [];
}

export async function getFolder(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("folders").select("id, name, color, subject_id, exam_date, created_at").eq("id", id).maybeSingle();
  return data;
}

export type FolderItems = {
  files: FileSummary[];
  generations: { id: string; title: string; kind: GenerationKind; createdAt: string }[];
  decks: { id: string; title: string; cardsCount: number; updatedAt: string }[];
  quizzes: { id: string; title: string; kind: "quiz" | "mock_exam"; questionsCount: number; updatedAt: string }[];
  conversations: { id: string; title: string; lastMessageAt: string }[];
  materials: MaterialCard[];
};

/**
 * Itens de uma pasta (folderId) ou os que ainda não estão em pasta nenhuma (null),
 * usados no diálogo "Adicionar à pasta".
 */
export async function listFolderItems(folderId: string | null, limit = 100): Promise<FolderItems> {
  const supabase = await createSupabaseServerClient();
  const files = supabase.from("uploaded_files").select("*").eq("purpose", "study").neq("status", "pending_upload");
  const generations = supabase.from("ai_generations").select("id, title, kind, created_at").eq("status", "completed");
  const decks = supabase.from("flashcard_decks").select("id, title, cards_count, updated_at");
  const quizzes = supabase.from("quizzes").select("id, title, kind, questions_count, updated_at");
  const conversations = supabase.from("ai_conversations").select("id, title, last_message_at");
  const saves = supabase.from("material_saves").select("created_at, study_materials(*)").eq("kind", "saved");

  const [fileRows, generationRows, deckRows, quizRows, conversationRows, saveRows] = await Promise.all([
    (folderId ? files.eq("folder_id", folderId) : files.is("folder_id", null)).order("created_at", { ascending: false }).limit(limit),
    (folderId ? generations.eq("folder_id", folderId) : generations.is("folder_id", null)).order("created_at", { ascending: false }).limit(limit),
    (folderId ? decks.eq("folder_id", folderId) : decks.is("folder_id", null)).order("updated_at", { ascending: false }).limit(limit),
    (folderId ? quizzes.eq("folder_id", folderId) : quizzes.is("folder_id", null)).order("updated_at", { ascending: false }).limit(limit),
    (folderId ? conversations.eq("folder_id", folderId) : conversations.is("folder_id", null))
      .order("last_message_at", { ascending: false })
      .limit(limit),
    (folderId ? saves.eq("folder_id", folderId) : saves.is("folder_id", null)).order("created_at", { ascending: false }).limit(limit),
  ]);

  const materialRows = (saveRows.data ?? []).flatMap((s) => (s.study_materials ? [s.study_materials] : []));
  return {
    files: (fileRows.data ?? []).map(toFileSummary),
    generations: (generationRows.data ?? []).map((g) => ({ id: g.id, title: g.title, kind: g.kind, createdAt: g.created_at })),
    decks: (deckRows.data ?? []).map((d) => ({ id: d.id, title: d.title, cardsCount: d.cards_count, updatedAt: d.updated_at })),
    quizzes: (quizRows.data ?? []).map((q) => ({ id: q.id, title: q.title, kind: q.kind, questionsCount: q.questions_count, updatedAt: q.updated_at })),
    conversations: (conversationRows.data ?? []).map((c) => ({ id: c.id, title: c.title, lastMessageAt: c.last_message_at })),
    materials: await toCardFromRow(materialRows),
  };
}
