import "server-only";

import type { SrsFields } from "@/lib/domain/srs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DeckSummary = {
  id: string;
  title: string;
  description: string | null;
  subjectId: string | null;
  cardsCount: number;
  dueCount: number;
  newCount: number;
  updatedAt: string;
};

export type CardView = SrsFields & {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  explanation: string | null;
  suspended: boolean;
};

const CARD_FIELDS =
  "id, deck_id, front, back, explanation, suspended, state, due_at, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, last_review_at";

/** Baralhos com contagem de cartões vencidos e novos (RLS: só os do usuário). */
export async function listDecks(): Promise<DeckSummary[]> {
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();
  const [{ data: decks }, { data: due }] = await Promise.all([
    supabase.from("flashcard_decks").select("id, title, description, subject_id, cards_count, updated_at").order("updated_at", { ascending: false }).limit(200),
    supabase.from("flashcards").select("deck_id, state").eq("suspended", false).lte("due_at", nowIso).limit(10_000),
  ]);
  const dueBy = new Map<string, { due: number; fresh: number }>();
  for (const row of due ?? []) {
    const entry = dueBy.get(row.deck_id) ?? { due: 0, fresh: 0 };
    if (row.state === "new") entry.fresh += 1;
    else entry.due += 1;
    dueBy.set(row.deck_id, entry);
  }
  return (decks ?? []).map((deck) => ({
    id: deck.id,
    title: deck.title,
    description: deck.description,
    subjectId: deck.subject_id,
    cardsCount: deck.cards_count,
    dueCount: dueBy.get(deck.id)?.due ?? 0,
    newCount: dueBy.get(deck.id)?.fresh ?? 0,
    updatedAt: deck.updated_at,
  }));
}

export async function getDeck(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data: deck } = await supabase
    .from("flashcard_decks")
    .select("id, title, description, subject_id, cards_count, source_generation_id, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!deck) return null;
  const { data: cards } = await supabase.from("flashcards").select(CARD_FIELDS).eq("deck_id", id).order("created_at").limit(2000);
  return { deck, cards: (cards ?? []) as CardView[] };
}

export type ReviewMode = "rapida" | "completa";

export const NEW_CARDS_PER_SESSION = 20;

/**
 * Fila de revisão: primeiro os cartões vencidos (mais atrasados antes), depois os
 * novos, até o limite do modo. Filtra por baralho ou por matéria.
 */
export async function getReviewQueue(options: { deckId?: string | null; subjectId?: string | null; mode: ReviewMode }): Promise<CardView[]> {
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();
  let deckIds: string[] | null = null;
  if (options.deckId) deckIds = [options.deckId];
  else if (options.subjectId) {
    const { data } = await supabase.from("flashcard_decks").select("id").eq("subject_id", options.subjectId);
    deckIds = (data ?? []).map((d) => d.id);
    if (!deckIds.length) return [];
  }
  const total = options.mode === "rapida" ? 20 : 200;

  let dueQuery = supabase
    .from("flashcards")
    .select(CARD_FIELDS)
    .eq("suspended", false)
    .neq("state", "new")
    .lte("due_at", nowIso)
    .order("due_at")
    .limit(total);
  if (deckIds) dueQuery = dueQuery.in("deck_id", deckIds);
  const { data: due } = await dueQuery;

  const room = Math.min(NEW_CARDS_PER_SESSION, total - (due?.length ?? 0));
  let fresh: CardView[] = [];
  if (room > 0) {
    let newQuery = supabase.from("flashcards").select(CARD_FIELDS).eq("suspended", false).eq("state", "new").order("created_at").limit(room);
    if (deckIds) newQuery = newQuery.in("deck_id", deckIds);
    const { data } = await newQuery;
    fresh = (data ?? []) as CardView[];
  }
  return [...((due ?? []) as CardView[]), ...fresh];
}
