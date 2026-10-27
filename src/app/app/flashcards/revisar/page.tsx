import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { getReviewQueue, type ReviewMode } from "@/lib/data/flashcards";
import { getSubjectMap } from "@/lib/data/subjects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";

import { ReviewSession } from "../_components/review-session";

export const metadata: Metadata = { title: "Revisão de flashcards" };

export default function ReviewPage({ searchParams }: PageProps<"/app/flashcards/revisar">) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5" aria-busy="true" aria-label="Preparando revisão">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-72" />
        </div>
      }
    >
      <Review searchParams={searchParams} />
    </Suspense>
  );
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function Review({ searchParams }: { searchParams: PageProps<"/app/flashcards/revisar">["searchParams"] }) {
  await requireStudent("/app/flashcards");
  const params = await searchParams;
  const deckId = uuidSchema.safeParse(one(params.baralho)).data ?? null;
  const subjectId = uuidSchema.safeParse(one(params.materia)).data ?? null;
  const mode: ReviewMode = one(params.modo) === "rapida" ? "rapida" : "completa";

  const [queue, subjectMap] = await Promise.all([getReviewQueue({ deckId, subjectId, mode }), getSubjectMap()]);
  let label = mode === "rapida" ? "Revisão rápida: até 20 cartões" : "Revisão completa: todos os cartões vencidos";
  let backHref = "/app/flashcards";
  if (deckId) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("flashcard_decks").select("title").eq("id", deckId).maybeSingle();
    if (data) label = `Baralho: ${data.title}`;
    backHref = `/app/flashcards/${deckId}`;
  } else if (subjectId) {
    label = `Matéria: ${subjectMap.get(subjectId)?.name ?? "selecionada"}`;
  }

  return (
    <ReviewSession
      key={`${deckId}-${subjectId}-${mode}`}
      initialQueue={queue.map((c) => ({
        id: c.id,
        front: c.front,
        back: c.back,
        explanation: c.explanation,
        state: c.state,
        due_at: c.due_at,
        stability: c.stability,
        difficulty: c.difficulty,
        elapsed_days: c.elapsed_days,
        scheduled_days: c.scheduled_days,
        learning_steps: c.learning_steps,
        reps: c.reps,
        lapses: c.lapses,
        last_review_at: c.last_review_at,
      }))}
      backHref={backHref}
      label={label}
    />
  );
}
