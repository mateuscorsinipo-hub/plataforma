import { CircleHelpIcon, SparklesIcon, TimerIcon } from "lucide-react";
import Link from "next/link";

import { SubjectChip } from "@/components/brand/subject-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { getPlanForUser } from "@/lib/billing/entitlements";
import { listQuizzes, type QuizKind } from "@/lib/data/quizzes";
import { getSubjectMap, getSubjects } from "@/lib/data/subjects";

import { ComposeMockDialog, NewQuizDialog } from "./new-quiz-dialog";

function scoreLabel(a: NonNullable<Awaited<ReturnType<typeof listQuizzes>>[number]["lastAttempt"]>): string {
  if (a.status === "in_progress") return "Em andamento";
  if (a.status === "submitted") return "Aguardando avaliação";
  if (a.total) return `${a.correct ?? 0}/${a.total} acertos`;
  return "Concluído";
}

export async function QuizList({ kind }: { kind: QuizKind }) {
  const { user } = await requireStudent(kind === "quiz" ? "/app/quizzes" : "/app/simulados");
  const [items, subjects, subjectMap, plan] = await Promise.all([listQuizzes(kind), getSubjects(), getSubjectMap(), getPlanForUser(user.id)]);
  const isMock = kind === "mock_exam";
  const Icon = isMock ? TimerIcon : CircleHelpIcon;

  return (
    <>
      <PageHeader
        eyebrow="Praticar"
        title={isMock ? "Simulados" : "Quizzes"}
        description={
          isMock
            ? "Provas cronometradas com navegação entre questões, marcação para revisar e relatório por tema."
            : "Questões de múltipla escolha, verdadeiro ou falso e abertas, com gabarito comentado."
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/app/estudio">
                <SparklesIcon /> Gerar com IA
              </Link>
            </Button>
            {isMock ? <ComposeMockDialog subjects={subjects} maxQuestions={plan.maxMockExamQuestions} /> : null}
            <NewQuizDialog kind={kind} subjects={subjects} />
          </>
        }
      />
      {items.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const subject = item.subjectId ? subjectMap.get(item.subjectId) : null;
            return (
              <li key={item.id}>
                <Card className="h-full gap-3">
                  <Link href={`/app/quizzes/${item.id}`} className="font-display text-lg leading-snug font-bold hover:text-primary">
                    {item.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2">
                    {subject ? <SubjectChip subject={subject} size="sm" /> : null}
                    <Badge variant="neutral">
                      {item.questionsCount} {item.questionsCount === 1 ? "questão" : "questões"}
                    </Badge>
                    {item.durationMinutes ? <Badge variant="neutral">{item.durationMinutes} min</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{item.lastAttempt ? `Última tentativa: ${scoreLabel(item.lastAttempt)}` : "Ainda não feito"}</p>
                  <div className="mt-auto pt-1">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/app/quizzes/${item.id}`}>Abrir</Link>
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={Icon}
          title={isMock ? "Nenhum simulado ainda" : "Nenhum quiz ainda"}
          description={
            isMock
              ? "Gere um simulado no estilo ENEM ou vestibular a partir do seu material, monte um com as questões dos seus quizzes ou crie do zero."
              : "Gere um quiz com IA a partir do seu material ou escreva as questões você mesmo."
          }
          action={
            <Button asChild>
              <Link href="/app/estudio">
                <SparklesIcon /> Gerar no estúdio
              </Link>
            </Button>
          }
        />
      )}
    </>
  );
}
