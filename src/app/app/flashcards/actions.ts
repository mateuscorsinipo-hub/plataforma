"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseStoredContent } from "@/lib/ai/studio/content";
import { requireUser } from "@/lib/auth/session";
import { getUserTimezone } from "@/lib/billing/entitlements";
import { parseCardImport } from "@/lib/domain/card-import";
import { XP_RULES } from "@/lib/domain/gamification";
import { isGrade, scheduleReview, type SrsFields } from "@/lib/domain/srs";
import { logger } from "@/lib/logger";
import { achievementTitles, recordProgress } from "@/lib/progress/record";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fieldErrorsOf, formDataToObject, uuidSchema, type ActionState } from "@/lib/validation/common";
import { cardSchema, deckSchema } from "@/lib/validation/flashcards";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function subjectExists(subjectId: string | null): Promise<boolean> {
  if (!subjectId) return true;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("subjects").select("id").eq("id", subjectId).maybeSingle();
  return Boolean(data);
}

export async function createDeck(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/app/flashcards");
  const parsed = deckSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: "Revise os campos.", fieldErrors: fieldErrorsOf(parsed.error) };
  if (!(await subjectExists(parsed.data.subjectId))) return { error: "Matéria inválida." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("flashcard_decks")
    .insert({ user_id: user.id, title: parsed.data.title, description: parsed.data.description, subject_id: parsed.data.subjectId })
    .select("id")
    .single();
  if (error || !data) return { error: "Não foi possível criar o baralho." };
  await recordProgress({ userId: user.id, timezone: await getUserTimezone(user.id) });
  redirect(`/app/flashcards/${data.id}`);
}

export async function updateDeck(deckId: string, input: { title: string; description: string; subjectId: string }): Promise<Result> {
  await requireUser("/app/flashcards");
  const id = uuidSchema.safeParse(deckId);
  const parsed = deckSchema.safeParse(input);
  if (!id.success) return { ok: false, error: "Baralho inválido." };
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (!(await subjectExists(parsed.data.subjectId))) return { ok: false, error: "Matéria inválida." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("flashcard_decks")
    .update({ title: parsed.data.title, description: parsed.data.description, subject_id: parsed.data.subjectId })
    .eq("id", id.data)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível salvar." };
  refresh();
  return { ok: true };
}

export async function deleteDeck(deckId: string): Promise<Result> {
  await requireUser("/app/flashcards");
  const id = uuidSchema.safeParse(deckId);
  if (!id.success) return { ok: false, error: "Baralho inválido." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("flashcard_decks").delete().eq("id", id.data).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível excluir o baralho." };
  redirect("/app/flashcards?baralho-excluido=1");
}

export async function addCard(deckId: string, input: { front: string; back: string; explanation?: string }): Promise<Result<{ id: string }>> {
  const user = await requireUser("/app/flashcards");
  const id = uuidSchema.safeParse(deckId);
  const parsed = cardSchema.safeParse(input);
  if (!id.success) return { ok: false, error: "Baralho inválido." };
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("flashcards")
    .insert({ deck_id: id.data, user_id: user.id, front: parsed.data.front, back: parsed.data.back, explanation: parsed.data.explanation })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Não foi possível adicionar o cartão." };
  refresh();
  return { ok: true, id: data.id };
}

export async function updateCard(cardId: string, input: { front: string; back: string; explanation?: string }): Promise<Result> {
  await requireUser("/app/flashcards");
  const id = uuidSchema.safeParse(cardId);
  const parsed = cardSchema.safeParse(input);
  if (!id.success) return { ok: false, error: "Cartão inválido." };
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("flashcards")
    .update({ front: parsed.data.front, back: parsed.data.back, explanation: parsed.data.explanation })
    .eq("id", id.data)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível salvar o cartão." };
  refresh();
  return { ok: true };
}

export async function deleteCard(cardId: string): Promise<Result> {
  await requireUser("/app/flashcards");
  const id = uuidSchema.safeParse(cardId);
  if (!id.success) return { ok: false, error: "Cartão inválido." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("flashcards").delete().eq("id", id.data).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível excluir o cartão." };
  refresh();
  return { ok: true };
}

export async function setCardSuspended(cardId: string, suspended: boolean): Promise<Result> {
  await requireUser("/app/flashcards");
  const id = uuidSchema.safeParse(cardId);
  if (!id.success) return { ok: false, error: "Cartão inválido." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("flashcards").update({ suspended }).eq("id", id.data).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível atualizar o cartão." };
  refresh();
  return { ok: true };
}

export async function importCards(deckId: string, text: string): Promise<Result<{ imported: number; skipped: number[] }>> {
  const user = await requireUser("/app/flashcards");
  const id = uuidSchema.safeParse(deckId);
  if (!id.success) return { ok: false, error: "Baralho inválido." };
  if (text.length > 600_000) return { ok: false, error: "Texto grande demais para importar de uma vez." };
  const { cards, skipped } = parseCardImport(text, 500);
  if (!cards.length) return { ok: false, error: "Nenhum cartão reconhecido. Use uma linha por cartão: frente;verso." };
  const supabase = await createSupabaseServerClient();
  const { data: deck } = await supabase.from("flashcard_decks").select("id, cards_count").eq("id", id.data).maybeSingle();
  if (!deck) return { ok: false, error: "Baralho não encontrado." };
  if (deck.cards_count + cards.length > 2000) return { ok: false, error: "Um baralho pode ter até 2.000 cartões." };
  const { error } = await supabase.from("flashcards").insert(cards.map((c) => ({ deck_id: id.data, user_id: user.id, front: c.front, back: c.back })));
  if (error) return { ok: false, error: "Não foi possível importar os cartões." };
  refresh();
  return { ok: true, imported: cards.length, skipped };
}

/** Transforma flashcards gerados no estúdio em um baralho de verdade (com revisão espaçada). */
export async function saveGenerationAsDeck(generationId: string): Promise<Result> {
  const user = await requireUser("/app/estudio");
  const id = uuidSchema.safeParse(generationId);
  if (!id.success) return { ok: false, error: "Material inválido." };
  const supabase = await createSupabaseServerClient();
  const { data: generation } = await supabase
    .from("ai_generations")
    .select("id, title, kind, status, content, subject_id, folder_id")
    .eq("id", id.data)
    .maybeSingle();
  const content = parseStoredContent(generation?.content);
  if (!generation || generation.status !== "completed" || content?.kind !== "flashcards") {
    return { ok: false, error: "Este material não é um conjunto de flashcards pronto." };
  }
  const { data: existing } = await supabase.from("flashcard_decks").select("id").eq("source_generation_id", generation.id).maybeSingle();
  if (existing) redirect(`/app/flashcards/${existing.id}`);

  const { data: deck, error } = await supabase
    .from("flashcard_decks")
    .insert({
      user_id: user.id,
      title: generation.title.slice(0, 120),
      description: "Criado a partir de flashcards gerados no Estúdio.",
      subject_id: generation.subject_id,
      folder_id: generation.folder_id,
      source_generation_id: generation.id,
    })
    .select("id")
    .single();
  if (error || !deck) return { ok: false, error: "Não foi possível criar o baralho." };
  const { error: cardsError } = await supabase.from("flashcards").insert(
    content.cards.map((card) => ({
      deck_id: deck.id,
      user_id: user.id,
      front: card.front.slice(0, 2000),
      back: card.back.slice(0, 4000),
      explanation: card.hint ? `Dica: ${card.hint}`.slice(0, 4000) : null,
    })),
  );
  if (cardsError) {
    await supabase.from("flashcard_decks").delete().eq("id", deck.id);
    logger.error("flashcards.save_generation_failed", { code: cardsError.code });
    return { ok: false, error: "Não foi possível salvar os cartões." };
  }
  await recordProgress({ userId: user.id, timezone: await getUserTimezone(user.id) });
  redirect(`/app/flashcards/${deck.id}`);
}

const reviewSchema = z.object({
  cardId: z.uuid(),
  rating: z.number().int().refine(isGrade, "Avaliação inválida."),
  durationMs: z.number().int().min(0).max(3_600_000),
});

export type ReviewResult =
  | { ok: true; card: SrsFields & { id: string }; xp: number; unlocked: string[] }
  | { ok: false; error: string; stale?: boolean };

/**
 * Aplica uma revisão: o agendamento é calculado aqui, com o relógio do servidor;
 * o banco grava de forma atômica e recusa revisão duplicada (outra aba).
 */
export async function reviewCard(input: { cardId: string; rating: number; durationMs: number }): Promise<ReviewResult> {
  const user = await requireUser("/app/flashcards");
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisão inválida." };
  const supabase = await createSupabaseServerClient();
  const { data: card } = await supabase
    .from("flashcards")
    .select("id, deck_id, state, due_at, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, last_review_at, flashcard_decks(subject_id)")
    .eq("id", parsed.data.cardId)
    .maybeSingle();
  if (!card) return { ok: false, error: "Cartão não encontrado." };

  const now = new Date();
  const rating = parsed.data.rating as Parameters<typeof scheduleReview>[1];
  const next = scheduleReview(card as SrsFields, rating, now);
  const { data: reviewId, error } = await supabase.rpc("apply_flashcard_review", {
    p_card_id: card.id,
    p_rating: rating,
    p_expected_last_review: card.last_review_at ?? (null as unknown as string),
    p_state: next.state,
    p_due_at: next.due_at,
    p_stability: next.stability,
    p_difficulty: next.difficulty,
    p_elapsed_days: next.elapsed_days,
    p_scheduled_days: next.scheduled_days,
    p_learning_steps: next.learning_steps,
    p_reps: next.reps,
    p_lapses: next.lapses,
    p_reviewed_at: now.toISOString(),
    p_duration_ms: parsed.data.durationMs,
  });
  if (error || !reviewId) {
    if (error?.code === "40001") return { ok: false, error: "Este cartão já foi revisado em outra aba.", stale: true };
    logger.error("flashcards.review_failed", { code: error?.code ?? "no_id" });
    return { ok: false, error: "Não foi possível registrar a revisão." };
  }

  const timezone = await getUserTimezone(user.id);
  const progress = await recordProgress({
    userId: user.id,
    timezone,
    xp: { ...XP_RULES.flashcardReview, sourceType: "flashcard_review", sourceId: reviewId, reason: "Revisão de flashcard" },
    // Tempo por cartão limitado a 2 minutos: evita contar a aba esquecida aberta.
    session: {
      activityType: "flashcards",
      sourceId: reviewId,
      durationSeconds: Math.min(120, Math.max(2, parsed.data.durationMs / 1000)),
      subjectId: card.flashcard_decks?.subject_id ?? null,
    },
  });
  return {
    ok: true,
    card: { id: card.id, ...next, last_review_at: now.toISOString() },
    xp: progress.xpAwarded,
    unlocked: await achievementTitles(progress.unlocked),
  };
}
