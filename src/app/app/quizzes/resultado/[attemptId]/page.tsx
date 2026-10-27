import { ArrowLeftIcon, BotIcon, CheckIcon, XIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { MarkdownView } from "@/components/ai/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader, Skeleton } from "@/components/ui/feedback";
import { Progress } from "@/components/ui/primitives";
import { requireStudent } from "@/lib/auth/session";
import { getAttempt } from "@/lib/data/quizzes";
import { getSubjectMap } from "@/lib/data/subjects";
import { cn } from "@/lib/utils";
import { uuidSchema } from "@/lib/validation/common";

import { RetryButton } from "../../_components/retry-button";
import { SelfAssessment } from "../../_components/self-assessment";

export const metadata: Metadata = { title: "Resultado" };

type Feedback =
  | { type: "ai"; verdict: "correct" | "partial" | "incorrect"; feedback: string; missingPoints: string[] }
  | { type: "self"; level: "correct" | "partial" | "wrong" };

function parseFeedback(value: unknown): Feedback | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.type === "ai" && typeof v.feedback === "string") {
    return {
      type: "ai",
      verdict: v.verdict === "correct" || v.verdict === "partial" ? v.verdict : "incorrect",
      feedback: v.feedback,
      missingPoints: Array.isArray(v.missingPoints) ? v.missingPoints.filter((p): p is string => typeof p === "string") : [],
    };
  }
  if (v.type === "self") return { type: "self", level: v.level === "correct" || v.level === "partial" ? v.level : "wrong" };
  return null;
}

const verdictLabels = { correct: "Correta", partial: "Parcialmente correta", incorrect: "Incorreta", wrong: "Incorreta" } as const;

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m} min ${s ? `${s} s` : ""}`.trim() : `${s} s`;
}

export default function ResultPage({ params }: PageProps<"/app/quizzes/resultado/[attemptId]">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando resultado">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-40" />
          <Skeleton className="h-80" />
        </div>
      }
    >
      <Result params={params} />
    </Suspense>
  );
}

async function Result({ params }: { params: PageProps<"/app/quizzes/resultado/[attemptId]">["params"] }) {
  const { attemptId } = await params;
  await requireStudent(`/app/quizzes/resultado/${attemptId}`);
  const parsed = uuidSchema.safeParse(attemptId);
  if (!parsed.success) notFound();
  const [data, subjectMap] = await Promise.all([getAttempt(parsed.data), getSubjectMap()]);
  if (!data) notFound();
  const { attempt, quiz, questions } = data;
  if (attempt.status === "in_progress") redirect(`/app/quizzes/tentativa/${attempt.id}`);

  const answers = new Map(data.answers.map((a) => [a.question_id, a]));
  const score = Number(attempt.score ?? 0);
  const max = Number(attempt.max_score ?? 0);
  const percent = max > 0 ? Math.round((score / max) * 100) : 0;
  const pendingSelf = attempt.status === "submitted";

  // Desempenho por tema (ou matéria quando a questão não tem tema).
  const byTopic = new Map<string, { total: number; correct: number }>();
  for (const q of questions) {
    const key = q.topic || (q.subject_id ? subjectMap.get(q.subject_id)?.name : null) || "Geral";
    const entry = byTopic.get(key) ?? { total: 0, correct: 0 };
    entry.total += 1;
    if (answers.get(q.id)?.is_correct) entry.correct += 1;
    byTopic.set(key, entry);
  }
  const topics = [...byTopic.entries()].sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total);

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/app/quizzes/${quiz.id}`} className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> {quiz.title}
      </Link>
      <PageHeader eyebrow={quiz.kind === "mock_exam" ? "Resultado do simulado" : "Resultado do quiz"} title={pendingSelf ? "Falta avaliar suas respostas abertas" : `${percent}% de aproveitamento`} actions={<RetryButton quizId={quiz.id} />} />

      {pendingSelf ? (
        <Alert tone="info" title="Correção das questões abertas">
          Compare cada resposta aberta com a resposta esperada e marque como foi. A nota final aparece quando todas estiverem avaliadas.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="gap-1">
          <p className="text-sm text-muted-foreground">Acertos</p>
          <p className="font-display text-3xl font-extrabold">
            {attempt.correct_count ?? 0}/{attempt.total_count ?? questions.length}
          </p>
        </Card>
        <Card className="gap-1">
          <p className="text-sm text-muted-foreground">Pontuação</p>
          <p className="font-display text-3xl font-extrabold">
            {score.toLocaleString("pt-BR")} <span className="text-lg text-muted-foreground">/ {max.toLocaleString("pt-BR")}</span>
          </p>
        </Card>
        <Card className="gap-1">
          <p className="text-sm text-muted-foreground">Tempo</p>
          <p className="font-display text-3xl font-extrabold">{formatDuration(attempt.duration_seconds)}</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Desempenho por tema</CardTitle>
        </CardHeader>
        <ul className="flex flex-col gap-3">
          {topics.map(([topic, stat]) => {
            const pct = Math.round((stat.correct / stat.total) * 100);
            return (
              <li key={topic} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{topic}</span>
                  <span className="text-muted-foreground">
                    {stat.correct}/{stat.total} · {pct}%
                  </span>
                </div>
                <Progress value={pct} indicatorClassName={pct < 50 ? "bg-destructive" : pct < 70 ? "bg-warning-text" : "bg-success-text"} aria-label={`${topic}: ${pct}%`} />
              </li>
            );
          })}
        </ul>
      </Card>

      <section className="flex flex-col gap-4" aria-labelledby="revisao-titulo">
        <h2 id="revisao-titulo" className="text-lg font-bold">
          Revisão das questões
        </h2>
        <ol className="flex flex-col gap-4">
          {questions.map((q, index) => {
            const answer = answers.get(q.id);
            const feedback = parseFeedback(answer?.feedback);
            const correct = answer?.is_correct === true;
            const blank = !answer || (!answer.selected_option_id && !answer.answer_text?.trim());
            return (
              <li key={q.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="neutral" shape="tag">
                    Questão {index + 1}
                  </Badge>
                  {q.type === "open" && pendingSelf && !feedback && !blank ? (
                    <Badge variant="warning">Aguardando sua avaliação</Badge>
                  ) : blank ? (
                    <Badge variant="neutral">Em branco</Badge>
                  ) : correct ? (
                    <Badge variant="success">
                      <CheckIcon /> Acertou
                    </Badge>
                  ) : (
                    (feedback?.type === "ai" && feedback.verdict === "partial") || (feedback?.type === "self" && feedback.level === "partial") ? (
                      <Badge variant="warning">Acertou em parte</Badge>
                    ) : (
                      <Badge variant="danger">
                        <XIcon /> Errou
                      </Badge>
                    )
                  )}
                  {q.topic ? <span className="text-muted-foreground">{q.topic}</span> : null}
                </div>
                <MarkdownView content={q.prompt} className="text-[0.9375rem]" />

                {q.type !== "open" ? (
                  <ul className="flex flex-col gap-2">
                    {q.options.map((option) => {
                      const isCorrect = option.id === q.correct_option_id;
                      const chosen = option.id === answer?.selected_option_id;
                      return (
                        <li
                          key={option.id}
                          className={cn(
                            "flex items-start gap-3 rounded-xl border border-border px-3.5 py-2.5 text-sm",
                            isCorrect && "border-success-text/40 bg-success-soft",
                            chosen && !isCorrect && "border-destructive/40 bg-destructive-soft",
                          )}
                        >
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold uppercase">
                            {q.type === "true_false" ? (option.id === "true" ? "V" : "F") : option.id}
                          </span>
                          <MarkdownView content={option.text} className="min-w-0 flex-1 text-sm" />
                          {chosen ? <span className="shrink-0 text-xs font-semibold">Sua resposta</span> : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="rounded-xl border border-border px-4 py-3">
                      <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Sua resposta</p>
                      <p className="text-sm whitespace-pre-line">{answer?.answer_text?.trim() || "Em branco"}</p>
                    </div>
                    {q.reference_answer ? (
                      <div className="rounded-xl bg-success-soft/60 px-4 py-3">
                        <p className="mb-1 text-xs font-semibold text-success-text uppercase">Resposta esperada</p>
                        <MarkdownView content={q.reference_answer} className="text-sm" />
                      </div>
                    ) : null}
                    {feedback?.type === "ai" ? (
                      <div className="rounded-xl border border-[#c9d6fb] bg-secondary/60 px-4 py-3 text-sm">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-secondary-foreground uppercase">
                          <BotIcon className="size-3.5" aria-hidden="true" /> Correção automática por IA · {verdictLabels[feedback.verdict]}
                        </p>
                        <p className="leading-relaxed">{feedback.feedback}</p>
                        {feedback.missingPoints.length ? (
                          <ul className="mt-2 list-disc pl-5 text-ink-2">
                            {feedback.missingPoints.map((p) => (
                              <li key={p}>Faltou: {p}</li>
                            ))}
                          </ul>
                        ) : null}
                        <p className="mt-2 text-xs text-muted-foreground">A correção automática pode errar. Compare com a resposta esperada.</p>
                      </div>
                    ) : feedback?.type === "self" ? (
                      <p className="text-sm text-muted-foreground">Autoavaliação: {verdictLabels[feedback.level]}.</p>
                    ) : pendingSelf && answer && !blank ? (
                      <SelfAssessment answerId={answer.id} />
                    ) : null}
                  </div>
                )}

                {q.explanation ? (
                  <div className="rounded-xl bg-muted/70 px-4 py-3 text-sm">
                    <p className="mb-1 font-semibold">Explicação</p>
                    <MarkdownView content={q.explanation} className="text-sm" />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="flex flex-wrap gap-2">
        <RetryButton quizId={quiz.id} />
        <Button variant="outline" asChild>
          <Link href={quiz.kind === "mock_exam" ? "/app/simulados" : "/app/quizzes"}>Voltar à lista</Link>
        </Button>
      </div>
    </div>
  );
}
