import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { getAttempt } from "@/lib/data/quizzes";
import { uuidSchema } from "@/lib/validation/common";

import { AttemptRunner } from "../../_components/attempt-runner";

export const metadata: Metadata = { title: "Fazendo a prova" };

export default function AttemptPage({ params }: PageProps<"/app/quizzes/tentativa/[attemptId]">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando prova">
          <Skeleton className="h-14" />
          <Skeleton className="h-80" />
        </div>
      }
    >
      <Attempt params={params} />
    </Suspense>
  );
}

async function Attempt({ params }: { params: PageProps<"/app/quizzes/tentativa/[attemptId]">["params"] }) {
  const { attemptId } = await params;
  await requireStudent(`/app/quizzes/tentativa/${attemptId}`);
  const parsed = uuidSchema.safeParse(attemptId);
  if (!parsed.success) notFound();
  const data = await getAttempt(parsed.data);
  if (!data) notFound();
  if (data.attempt.status !== "in_progress") redirect(`/app/quizzes/resultado/${data.attempt.id}`);

  const answers = Object.fromEntries(
    data.answers.map((a) => [a.question_id, { selected: a.selected_option_id, text: a.answer_text ?? "" }]),
  );
  return (
    <AttemptRunner
      key={data.attempt.id}
      attemptId={data.attempt.id}
      title={data.quiz.title}
      isMock={data.quiz.kind === "mock_exam"}
      deadlineAt={data.attempt.deadline_at}
      serverNow={new Date().toISOString()}
      // Gabarito e explicações não vão para o navegador durante a prova.
      questions={data.questions.map((q) => ({ id: q.id, type: q.type, prompt: q.prompt, options: q.type === "open" ? [] : q.options }))}
      initialAnswers={answers}
      initialPosition={data.attempt.current_position}
      initialFlagged={data.attempt.flagged_question_ids}
    />
  );
}
