import {
  ArrowRightIcon,
  BookOpenIcon,
  CalendarPlusIcon,
  CircleCheckIcon,
  CircleHelpIcon,
  LayersIcon,
  MessageCircleIcon,
  PlusIcon,
  SparklesIcon,
  TimerIcon,
  UploadIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SubjectChip } from "@/components/brand/subject-chip";
import { UrlToast } from "@/components/app-shell/url-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { Progress } from "@/components/ui/primitives";
import { requireStudent } from "@/lib/auth/session";
import { materialTypeLabels, type MaterialType } from "@/lib/config/subjects";
import { loadDashboard, loadRecommendations } from "@/lib/data/dashboard";
import { getShellData } from "@/lib/data/shell";
import { getSubjectMap } from "@/lib/data/subjects";
import { daysBetween, formatDateBR, greetingFor, localDateString, localHour, weekdayLabel } from "@/lib/domain/dates";
import { leagueLabel } from "@/lib/domain/gamification";
import { reasonLabel } from "@/lib/domain/recommendations";
import { taskTypeLabels } from "@/lib/domain/study-plan";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Início" };

export default function DashboardPage() {
  return (
    <>
      <Suspense>
        <UrlToast />
      </Suspense>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </>
  );
}

async function Dashboard() {
  const { profile } = await requireStudent("/app");
  const shell = await getShellData();
  if (!shell) return null;
  const [data, subjects] = await Promise.all([loadDashboard(shell), getSubjectMap()]);
  const recommendations = await loadRecommendations({
    userId: shell.userId,
    subjectIds: data.followedSubjects.map((s) => s.subjectId),
    schoolStage: profile.school_stage,
    gradeYear: profile.grade_year,
    weakTopics: data.weakTopics,
  });

  const firstName = shell.displayName.split(" ")[0] ?? shell.displayName;
  const greeting = greetingFor(localHour(shell.timezone));
  const nextPlan = data.activePlans[0];
  const daysToExam = nextPlan ? daysBetween(shell.today, nextPlan.exam_date) : null;
  const pendingTasks = data.todayTasks.filter((t) => t.status === "pending");
  const goalPercent = Math.min(100, Math.round((data.todayMinutes / Math.max(1, data.dailyGoal)) * 100));
  const maxWeek = Math.max(data.dailyGoal, ...data.week.map((d) => d.minutes));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[1.9rem] leading-tight font-extrabold sm:text-[2.3rem]">
            {greeting}, {firstName}
          </h1>
          <p className="text-[0.9375rem] text-ink-2">
            {nextPlan && daysToExam !== null && daysToExam >= 0 ? (
              <>
                {daysToExam === 0 ? "A prova é hoje" : `Faltam ${daysToExam} ${daysToExam === 1 ? "dia" : "dias"}`} para{" "}
                <strong>{nextPlan.title}</strong>.{" "}
              </>
            ) : null}
            {pendingTasks.length
              ? `Hoje o plano tem ${pendingTasks.length} ${pendingTasks.length === 1 ? "tarefa pendente" : "tarefas pendentes"}.`
              : data.todayTasks.length
                ? "Você concluiu as tarefas de hoje."
                : "Escolha por onde começar hoje."}
          </p>
        </div>
        <Button asChild>
          <Link href="/app/estudio">
            <UploadIcon />
            Enviar material
          </Link>
        </Button>
      </div>

      {data.isNewUser ? <WelcomeCard /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="gap-3">
          <p className="text-sm font-semibold text-muted-foreground">Meta de hoje</p>
          <p className="flex items-baseline gap-1.5">
            <span className="font-display text-[2.1rem] font-extrabold">{data.todayMinutes}</span>
            <span className="text-[0.9375rem] text-muted-foreground">de {data.dailyGoal} min</span>
          </p>
          <Progress value={goalPercent} aria-label={`Meta diária: ${goalPercent}%`} indicatorClassName={goalPercent >= 100 ? "bg-success" : undefined} />
          <p className="text-xs text-muted-foreground">
            {goalPercent >= 100 ? "Meta cumprida. Ótimo trabalho!" : "Conta o tempo de revisões, quizzes, simulados e foco."}
          </p>
        </Card>
        <Card className="gap-3">
          <p className="text-sm font-semibold text-muted-foreground">Esta semana · {data.weekMinutes} min</p>
          <div className="flex h-16 items-end gap-1.5" role="img" aria-label={`Minutos estudados por dia nesta semana: ${data.week.map((d) => `${weekdayLabel(new Date(`${d.day}T12:00:00Z`).getUTCDay())} ${d.minutes}`).join(", ")}`}>
            {data.week.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <span
                  className={cn("w-full rounded-md", d.minutes > 0 ? (d.isToday ? "bg-primary" : "bg-primary/80") : "bg-border")}
                  style={{ height: `${Math.max(4, Math.round((d.minutes / Math.max(1, maxWeek)) * 46))}px` }}
                />
                <span className={cn("text-[0.6875rem]", d.isToday ? "font-bold text-foreground" : "text-muted-foreground")}>
                  {weekdayLabel(new Date(`${d.day}T12:00:00Z`).getUTCDay())}
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="gap-3">
          <p className="text-sm font-semibold text-muted-foreground">Flashcards para hoje</p>
          <p className="flex items-baseline gap-1.5">
            <span className="font-display text-[2.1rem] font-extrabold">{data.dueCount}</span>
            <span className="text-[0.9375rem] text-muted-foreground">
              {data.dueCount ? `em ${data.dueDecks} ${data.dueDecks === 1 ? "baralho" : "baralhos"}` : "para revisar"}
            </span>
          </p>
          {data.dueCount ? (
            <Button asChild variant="secondary" size="sm" className="self-start">
              <Link href="/app/flashcards/revisar">Revisar agora</Link>
            </Button>
          ) : (
            <Link href="/app/flashcards" className="text-sm font-semibold text-primary hover:underline">
              Criar ou gerar flashcards
            </Link>
          )}
        </Card>
        <Card className="gap-3">
          <p className="text-sm font-semibold text-muted-foreground">Seu progresso</p>
          <p className="flex items-baseline gap-1.5">
            <span className="font-display text-[2.1rem] font-extrabold">Nível {shell.level}</span>
          </p>
          <Progress value={shell.levelPercent} aria-label={`Progresso para o próximo nível: ${shell.levelPercent}%`} />
          <p className="text-xs text-muted-foreground">
            {shell.xpTotal.toLocaleString("pt-BR")} XP · liga {leagueLabel(shell.league)}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle>Hoje no seu plano</CardTitle>
            <Link href="/app/plano" className="text-sm font-semibold text-primary hover:underline">
              Ver cronograma
            </Link>
          </CardHeader>
          {data.activePlans.length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-2xl bg-background p-5">
              <p className="text-[0.9375rem] leading-relaxed text-ink-2">
                Você ainda não tem um plano de estudos ativo. Informe a prova, a data e o tempo disponível que montamos as
                tarefas de cada dia.
              </p>
              <Button asChild size="sm">
                <Link href="/app/plano/novo">
                  <CalendarPlusIcon />
                  Criar plano de estudos
                </Link>
              </Button>
            </div>
          ) : data.todayTasks.length === 0 ? (
            <p className="rounded-2xl bg-background p-5 text-[0.9375rem] text-ink-2">
              Nenhuma tarefa marcada para hoje. Aproveite para revisar flashcards ou adiantar o plano.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.todayTasks.map((task) => {
                const subject = task.subject_id ? subjects.get(task.subject_id) : undefined;
                const done = task.status === "done";
                return (
                  <li key={task.id} className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-lg",
                        done ? "bg-primary text-primary-foreground" : "border-2 border-[#a9beff]",
                      )}
                    >
                      {done ? <CircleCheckIcon className="size-4" /> : null}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={cn("truncate text-[0.9375rem] font-medium", done && "text-muted-foreground line-through")}>
                        {task.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {subject?.name ?? taskTypeLabels[task.task_type]} · {task.estimated_minutes} min
                        {done ? " · concluída" : null}
                      </span>
                    </div>
                    {task.priority === 1 && !done ? <Badge variant="warning">prioridade alta</Badge> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <CardTitle>Próximas provas</CardTitle>
              <Link href="/app/calendario" className="text-sm font-semibold text-primary hover:underline">
                Calendário
              </Link>
            </CardHeader>
            {data.exams.length === 0 ? (
              <p className="text-sm text-ink-2">
                Nenhuma prova cadastrada.{" "}
                <Link href="/app/calendario?novo=prova" className="font-semibold text-primary hover:underline">
                  Adicionar prova
                </Link>
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {data.exams.map((exam) => {
                  const day = localDateString(exam.timezone, new Date(exam.starts_at));
                  const until = daysBetween(shell.today, day);
                  const subject = exam.subject_id ? subjects.get(exam.subject_id) : undefined;
                  return (
                    <li key={exam.id} className="flex items-center gap-3">
                      <div className="flex h-13 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary py-1.5 text-secondary-foreground">
                        <strong className="text-lg leading-none">{formatDateBR(day, { day: "2-digit" })}</strong>
                        <span className="text-[0.6875rem] font-bold uppercase">{formatDateBR(day, { month: "short" }).replace(".", "")}</span>
                      </div>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <strong className="truncate text-[0.9375rem]">{exam.title}</strong>
                        <span className="text-[0.8125rem] text-muted-foreground">
                          {subject ? `${subject.name} · ` : ""}
                          {until <= 0 ? "hoje" : until === 1 ? "amanhã" : `em ${until} dias`}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle>Precisa de revisão</CardTitle>
            {data.weakTopics.length === 0 ? (
              <p className="text-sm leading-relaxed text-ink-2">
                Quando você fizer quizzes e simulados, os temas com mais erros aparecem aqui.
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {data.weakTopics.map((topic) => (
                  <li key={`${topic.subject_id}-${topic.topic}`} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{topic.topic}</span>
                    <strong className={cn("shrink-0", Number(topic.accuracy) < 0.5 ? "text-destructive-text" : "text-warning-text")}>
                      {Math.round(Number(topic.accuracy) * 100)}% de acerto
                    </strong>
                  </li>
                ))}
              </ul>
            )}
            {data.weakTopics.length ? (
              <Link href="/app/desempenho" className="text-sm font-semibold text-primary hover:underline">
                Ver desempenho completo
              </Link>
            ) : null}
          </Card>
        </div>
      </div>

      {data.followedSubjects.length ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle>Matérias em andamento</CardTitle>
            <Link href="/app/configuracoes#materias" className="text-sm font-semibold text-primary hover:underline">
              Editar
            </Link>
          </CardHeader>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.followedSubjects.map((item) => {
              const subject = subjects.get(item.subjectId);
              if (!subject) return null;
              return (
                <li key={item.subjectId} className="flex flex-col gap-2 rounded-2xl border border-border p-4">
                  <SubjectChip subject={subject} withIcon />
                  <p className="text-sm text-ink-2">
                    {item.accuracy === null
                      ? "Sem questões respondidas nos últimos 30 dias."
                      : `${item.accuracy}% de acerto em ${item.answered} questões (30 dias)`}
                  </p>
                  {item.accuracy !== null ? (
                    <Progress
                      value={item.accuracy}
                      aria-label={`Acerto em ${subject.name}`}
                      indicatorClassName={item.accuracy < 50 ? "bg-destructive" : item.accuracy < 70 ? "bg-warning" : "bg-success"}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle>Recomendados para você</CardTitle>
            <Link href="/app/biblioteca" className="text-sm font-semibold text-primary hover:underline">
              Biblioteca
            </Link>
          </CardHeader>
          {recommendations.length === 0 ? (
            <p className="text-sm leading-relaxed text-ink-2">
              Ainda não há materiais publicados nas suas matérias. Que tal ser a primeira pessoa a publicar?{" "}
              <Link href="/app/materiais/novo" className="font-semibold text-primary hover:underline">
                Publicar material
              </Link>
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recommendations.map(({ item: material, reason }) => {
                const subject = subjects.get(material.subject_id);
                return (
                  <li key={material.id}>
                    <Link
                      href={`/app/biblioteca/${material.slug}`}
                      className="flex items-center gap-3 rounded-2xl border border-border p-3.5 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <strong className="truncate text-[0.9375rem]">{material.title}</strong>
                        <span className="text-xs text-muted-foreground">
                          <span className="font-semibold text-primary">{reasonLabel(reason)}</span> · {subject?.name} ·{" "}
                          {materialTypeLabels[material.material_type as MaterialType]}
                        </span>
                      </div>
                      <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>Atividade recente</CardTitle>
          {data.recentXp.length === 0 ? (
            <p className="text-sm text-ink-2">Suas atividades de estudo concluídas aparecem aqui.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {data.recentXp.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{item.reason ?? "Atividade de estudo"}</span>
                  <Badge>+{item.amount} XP</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <nav aria-label="Atalhos" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/app/tutor", label: "Perguntar ao tutor", icon: MessageCircleIcon },
          { href: "/app/biblioteca", label: "Abrir a biblioteca", icon: BookOpenIcon },
          { href: "/app/quizzes", label: "Fazer um quiz", icon: CircleHelpIcon },
          { href: "/app/simulados", label: "Começar simulado", icon: TimerIcon },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 font-bold transition-colors hover:bg-muted/50"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function WelcomeCard() {
  const steps = [
    { href: "/app/estudio", icon: SparklesIcon, title: "Transforme um material", text: "Envie um PDF, slides ou foto do caderno e gere um resumo." },
    { href: "/app/plano/novo", icon: CalendarPlusIcon, title: "Monte seu plano", text: "Tarefas diárias até a data da prova." },
    { href: "/app/flashcards/novo", icon: LayersIcon, title: "Crie flashcards", text: "Manualmente ou a partir do seu material." },
  ];
  return (
    <section aria-labelledby="welcome-title" className="flex flex-col gap-4 rounded-3xl bg-foreground p-6 text-background sm:p-8">
      <div className="flex flex-col gap-1.5">
        <h2 id="welcome-title" className="font-display text-2xl font-extrabold">
          Por onde começar
        </h2>
        <p className="text-[0.9375rem] text-[#c3cbe0]">Três passos rápidos para o Grifo trabalhar a seu favor.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {steps.map(({ href, icon: Icon, title, text }) => (
          <Link key={href} href={href} className="flex flex-col gap-2 rounded-2xl bg-white/8 p-4 transition-colors hover:bg-white/12">
            <Icon className="size-5 text-highlight" aria-hidden="true" />
            <strong>{title}</strong>
            <span className="text-sm text-[#c3cbe0]">{text}</span>
          </Link>
        ))}
      </div>
      <Link href="/app/tutor" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-highlight hover:underline">
        <PlusIcon className="size-4" aria-hidden="true" />
        Ou faça sua primeira pergunta ao tutor
      </Link>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <Skeleton className="h-12 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
