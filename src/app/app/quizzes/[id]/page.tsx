import { ArrowLeftIcon, RotateCcwIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { MarkdownView } from "@/components/ai/markdown";
import { SubjectChip } from "@/components/brand/subject-chip";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, Skeleton } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { getUserTimezone } from "@/lib/billing/entitlements";
import { getQuizHistory, getQuizWithQuestions } from "@/lib/data/quizzes";
import { getSubjectMap } from "@/lib/data/subjects";
import { formatDateBR, localDateString } from "@/lib/domain/dates";
import { uuidSchema } from "@/lib/validation/common";

import { QuizActions } from "../_components/quiz-actions";

export const metadata: Metadata = { title: "Quiz" };

const examLabels: Record<string, string> = { enem: "Estilo ENEM", vestibular: "Estilo vestibular", school: "Prova da escola", custom: "Personalizado" };

export default function QuizPage({ params }: PageProps<"/app/quizzes/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-48" />
        </div>
      }
    >
      <Quiz params={params} />
    </Suspense>
  );
}

async function Quiz({ params }: { params: PageProps<"/app/quizzes/[id]">["params"] }) {
  const { id } = await params;
  const { user } = await requireStudent(`/app/quizzes/${id}`);
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) notFound();
  const [data, history, subjectMap, timezone] = await Promise.all([
    getQuizWithQuestions(parsed.data),
    getQuizHistory(parsed.data),
    getSubjectMap(),
    getUserTimezone(user.id),
  ]);
  if (!data) notFound();
  const { quiz, questions } = data;
  const isMock = quiz.kind === "mock_exam";
  const subject = quiz.subject_id ? subjectMap.get(quiz.subject_id) : null;
  const open = history.attempts.find((a) => a.status === "in_progress");
  const topics = [...new Set(questions.map((q) => q.topic).filter((t): t is string => Boolean(t)))];
  const types = {
    mc: questions.filter((q) => q.type === "multiple_choice").length,
    tf: questions.filter((q) => q.type === "true_false").length,
    open: questions.filter((q) => q.type === "open").length,
  };

  return (
    <div className="flex flex-col gap-6">
      <Link href={isMock ? "/app/simulados" : "/app/quizzes"} className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> {isMock ? "Simulados" : "Quizzes"}
      </Link>
      <PageHeader
        eyebrow={subject ? <SubjectChip subject={subject} size="sm" /> : isMock ? "Simulado" : "Quiz"}
        title={quiz.title}
        description={quiz.description ?? undefined}
      />
      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">
          {questions.length} {questions.length === 1 ? "questão" : "questões"}
        </Badge>
        {types.mc ? <Badge variant="outline">{types.mc} múltipla escolha</Badge> : null}
        {types.tf ? <Badge variant="outline">{types.tf} V ou F</Badge> : null}
        {types.open ? <Badge variant="outline">{types.open} abertas</Badge> : null}
        {quiz.duration_minutes ? <Badge variant="default">{quiz.duration_minutes} minutos</Badge> : null}
        {quiz.exam_type ? <Badge variant="outline">{examLabels[quiz.exam_type] ?? quiz.exam_type}</Badge> : null}
      </div>
      <QuizActions quizId={quiz.id} canStart={questions.length > 0} hasOpenAttempt={Boolean(open)} kindLabel={isMock ? "simulado" : "quiz"} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tentativas</CardTitle>
            <CardDescription>{history.attempts.length ? "Suas últimas tentativas, da mais recente para a mais antiga." : "Você ainda não fez este " + (isMock ? "simulado." : "quiz.")}</CardDescription>
          </CardHeader>
          {history.attempts.length ? (
            <ul className="-mx-2 flex flex-col">
              {history.attempts.map((attempt) => {
                const href = attempt.status === "in_progress" ? `/app/quizzes/tentativa/${attempt.id}` : `/app/quizzes/resultado/${attempt.id}`;
                const pct = attempt.max_score && Number(attempt.max_score) > 0 ? Math.round((Number(attempt.score ?? 0) / Number(attempt.max_score)) * 100) : null;
                return (
                  <li key={attempt.id}>
                    <Link href={href} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-sm hover:bg-muted">
                      <span>{formatDateBR(localDateString(timezone, new Date(attempt.started_at)), { day: "2-digit", month: "short", year: "numeric" })}</span>
                      <span className="font-semibold">
                        {attempt.status === "in_progress"
                          ? "Em andamento"
                          : attempt.status === "submitted"
                            ? "Aguardando sua avaliação"
                            : `${attempt.correct_count ?? 0}/${attempt.total_count ?? 0}${pct !== null ? ` · ${pct}%` : ""}`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcwIcon className="size-4 text-primary" aria-hidden="true" /> Erros recorrentes
            </CardTitle>
            <CardDescription>Questões que você errou em mais de uma tentativa.</CardDescription>
          </CardHeader>
          {history.recurring.length ? (
            <ul className="flex flex-col gap-3">
              {history.recurring.map((item) => (
                <li key={item.question_id} className="rounded-xl bg-muted/60 px-4 py-3 text-sm">
                  <MarkdownView content={item.prompt.length > 220 ? `${item.prompt.slice(0, 220)}…` : item.prompt} className="text-sm" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Errou {item.wrong} de {item.attempts} vezes{item.topic ? ` · ${item.topic}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum erro repetido até agora.</p>
          )}
        </Card>
      </div>

      {topics.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Temas cobertos</CardTitle>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            {topics.map((topic) => (
              <Badge key={topic} variant="outline">
                {topic}
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
