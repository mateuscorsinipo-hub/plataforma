import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageHeader, Skeleton } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { getQuizWithQuestions } from "@/lib/data/quizzes";
import { getSubjects } from "@/lib/data/subjects";
import { uuidSchema } from "@/lib/validation/common";

import { QuizEditor, type EditorQuestion } from "../../_components/quiz-editor";

export const metadata: Metadata = { title: "Editar questões" };

export default function EditQuizPage({ params }: PageProps<"/app/quizzes/[id]/editar">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando editor">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-64" />
        </div>
      }
    >
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: PageProps<"/app/quizzes/[id]/editar">["params"] }) {
  const { id } = await params;
  await requireStudent(`/app/quizzes/${id}/editar`);
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) notFound();
  const [data, subjects] = await Promise.all([getQuizWithQuestions(parsed.data), getSubjects()]);
  if (!data) notFound();
  const { quiz, questions } = data;

  const editorQuestions: EditorQuestion[] = questions.map((q) => {
    const correctIndex = Math.max(0, q.options.findIndex((o) => o.id === q.correct_option_id));
    const correct = q.options.find((o) => o.id === q.correct_option_id);
    return {
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      options: q.type === "multiple_choice" ? q.options.map((o) => o.text) : ["", "", "", ""],
      correctIndex,
      correctBoolean: q.correct_option_id !== "false",
      referenceAnswer: q.reference_answer ?? "",
      explanation: q.explanation ?? "",
      topic: q.topic ?? "",
      points: Number(q.points),
      correctLabel:
        q.type === "open"
          ? "resposta aberta (com resposta esperada)"
          : q.type === "true_false"
            ? correct?.text ?? "—"
            : `${(q.correct_option_id ?? "").toUpperCase()}) ${correct?.text ?? ""}`,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/app/quizzes/${quiz.id}`} className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Voltar
      </Link>
      <PageHeader eyebrow={quiz.kind === "mock_exam" ? "Editar simulado" : "Editar quiz"} title={quiz.title} />
      <QuizEditor
        key={quiz.id}
        quiz={{ id: quiz.id, kind: quiz.kind, title: quiz.title, description: quiz.description, subjectId: quiz.subject_id, durationMinutes: quiz.duration_minutes }}
        questions={editorQuestions}
        subjects={subjects}
      />
    </div>
  );
}
