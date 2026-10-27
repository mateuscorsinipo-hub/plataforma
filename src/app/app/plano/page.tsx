import { CalendarCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { UrlToast } from "@/components/app-shell/url-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader, Skeleton } from "@/components/ui/feedback";
import { Progress } from "@/components/ui/primitives";
import { aiAvailability } from "@/lib/ai";
import { requireStudent } from "@/lib/auth/session";
import { getUserTimezone } from "@/lib/billing/entitlements";
import { getActivePlan, getFocusTimer, listOtherPlans } from "@/lib/data/plans";
import { getSubjectMap, getSubjects } from "@/lib/data/subjects";
import { addDays, daysBetween, formatDateBR, localDateString } from "@/lib/domain/dates";
import { taskTypeLabels, type TaskType } from "@/lib/domain/study-plan";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { FocusTimer } from "./_components/focus-timer";
import { PlanCreator } from "./_components/plan-creator";
import { ActivatePlanButton, PlanMenu, ReorganizeButton } from "./_components/plan-menu";
import { TaskItem, type TaskView } from "./_components/task-item";

export const metadata: Metadata = { title: "Plano de estudos" };

export default function PlanPage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense>
        <UrlToast />
      </Suspense>
      <Suspense fallback={<PlanSkeleton />}>
        <Plan />
      </Suspense>
    </div>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function hrefFor(type: TaskType, subjectId: string | null): string | null {
  switch (type) {
    case "flashcards":
    case "review":
      return subjectId ? `/app/flashcards/revisar?modo=completa&materia=${subjectId}` : "/app/flashcards";
    case "quiz":
    case "exercises":
      return "/app/quizzes";
    case "mock_exam":
      return "/app/simulados";
    case "summary":
      return "/app/estudio";
    default:
      return "/app/tutor";
  }
}

async function Plan() {
  const { user } = await requireStudent("/app/plano");
  const [active, subjects, subjectMap, timezone, timer] = await Promise.all([
    getActivePlan(),
    getSubjects(),
    getSubjectMap(),
    getUserTimezone(user.id),
    getFocusTimer(),
  ]);
  const today = localDateString(timezone);
  const others = await listOtherPlans(active?.plan.id);

  if (!active) {
    const supabase = await createSupabaseServerClient();
    const [{ data: prefs }, { data: followed }] = await Promise.all([
      supabase.from("user_preferences").select("daily_goal_minutes, study_weekdays").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_subjects").select("subject_id").eq("user_id", user.id),
    ]);
    return (
      <>
        <PageHeader
          eyebrow="Organizar"
          title="Plano de estudos"
          description="Diga a data da prova, as matérias e quanto tempo você tem. O Grifo monta um cronograma com revisões espaçadas e simulados, e reorganiza quando você atrasar."
        />
        {others.length ? <OtherPlans plans={others} /> : null}
        <PlanCreator
          subjects={subjects.filter((s) => s.kind !== "other").map((s) => ({ id: s.id, name: s.name }))}
          preselected={(followed ?? []).map((f) => f.subject_id)}
          defaultMinutes={prefs?.daily_goal_minutes ?? 60}
          defaultWeekdays={prefs?.study_weekdays ?? [1, 2, 3, 4, 5]}
          minDate={addDays(today, 1)}
          aiAvailable={aiAvailability().available}
        />
      </>
    );
  }

  const { plan, tasks } = active;
  const toView = (t: (typeof tasks)[number], overdue = false): TaskView => ({
    id: t.id,
    title: t.title,
    description: t.description,
    typeLabel: taskTypeLabels[t.task_type],
    minutes: t.estimated_minutes,
    status: t.status,
    subjectName: t.subject_id ? (subjectMap.get(t.subject_id)?.name ?? null) : null,
    href: hrefFor(t.task_type, t.subject_id),
    overdueLabel: overdue ? `era para ${formatDateBR(t.scheduled_date)}` : null,
  });
  const done = tasks.filter((t) => t.status === "done").length;
  const total = tasks.filter((t) => t.status !== "skipped").length;
  const todayTasks = tasks.filter((t) => t.scheduled_date === today);
  const overdue = tasks.filter((t) => t.status === "pending" && t.scheduled_date < today);
  const upcomingDays = [...new Set(tasks.filter((t) => t.scheduled_date > today).map((t) => t.scheduled_date))].slice(0, 6);
  const daysLeft = daysBetween(today, plan.exam_date);
  const examPassed = daysLeft < 0;

  return (
    <>
      <PageHeader
        eyebrow="Plano de estudos"
        title={plan.title}
        description={
          examPassed
            ? `A prova foi em ${formatDateBR(plan.exam_date, { day: "2-digit", month: "long" })}. Arquive este plano e crie o próximo.`
            : daysLeft === 0
              ? "A prova é hoje. Boa prova!"
              : `Faltam ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"} para a prova (${formatDateBR(plan.exam_date, { day: "2-digit", month: "long" })}).`
        }
        actions={
          <>
            {overdue.length ? <ReorganizeButton planId={plan.id} overdue={overdue.length} /> : null}
            <PlanMenu planId={plan.id} title={plan.title} />
          </>
        }
      />

      <Card className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-semibold">
            {done} de {total} tarefas concluídas
          </span>
          <span className="text-muted-foreground">
            {plan.daily_minutes} min por dia · {plan.weekdays.length} {plan.weekdays.length === 1 ? "dia" : "dias"} por semana
          </span>
        </div>
        <Progress value={total ? (done / total) * 100 : 0} aria-label="Progresso do plano" />
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {overdue.length ? (
            <section className="flex flex-col gap-3" aria-labelledby="atrasadas">
              <h2 id="atrasadas" className="flex items-center gap-2 text-lg font-bold">
                Atrasadas <Badge variant="warning">{overdue.length}</Badge>
              </h2>
              <Alert tone="warning">Use “Reorganizar” para encaixar as atrasadas nos próximos dias sem passar da sua meta diária.</Alert>
              <ul className="flex flex-col gap-2">
                {overdue.slice(0, 8).map((t) => (
                  <TaskItem key={t.id} task={toView(t, true)} />
                ))}
              </ul>
            </section>
          ) : null}

          <section className="flex flex-col gap-3" aria-labelledby="hoje">
            <h2 id="hoje" className="text-lg font-bold">
              Hoje
            </h2>
            {todayTasks.length ? (
              <ul className="flex flex-col gap-2">
                {todayTasks.map((t) => (
                  <TaskItem key={t.id} task={toView(t)} />
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 rounded-xl bg-muted/60 px-4 py-4 text-sm text-muted-foreground">
                <CalendarCheckIcon className="size-4" aria-hidden="true" /> Hoje não é dia de estudo no seu plano. Aproveite para descansar ou revisar flashcards.
              </p>
            )}
          </section>

          {upcomingDays.length ? (
            <section className="flex flex-col gap-4" aria-labelledby="proximos">
              <h2 id="proximos" className="text-lg font-bold">
                Próximos dias
              </h2>
              {upcomingDays.map((day) => (
                <div key={day} className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">{capitalize(formatDateBR(day, { weekday: "long", day: "2-digit", month: "short" }))}</h3>
                  <ul className="flex flex-col gap-2">
                    {tasks
                      .filter((t) => t.scheduled_date === day)
                      .map((t) => (
                        <TaskItem key={t.id} task={{ ...toView(t), description: null }} />
                      ))}
                  </ul>
                </div>
              ))}
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6">
          <FocusTimer startedAt={timer?.started_at ?? null} subjects={subjects.map((s) => ({ id: s.id, name: s.name }))} />
          {others.length ? <OtherPlans plans={others} /> : null}
        </aside>
      </div>
    </>
  );
}

function OtherPlans({ plans }: { plans: Awaited<ReturnType<typeof listOtherPlans>> }) {
  const labels: Record<string, string> = { archived: "Arquivado", completed: "Concluído", paused: "Pausado", active: "Ativo" };
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base">Outros planos</CardTitle>
        <CardDescription>Reative um plano para voltar a segui-lo.</CardDescription>
      </CardHeader>
      <ul className="flex flex-col gap-2">
        {plans.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-medium">{p.title}</span>
              <span className="text-xs text-muted-foreground">
                {labels[p.status] ?? p.status} · prova em {formatDateBR(p.exam_date, { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            </span>
            {p.status !== "active" ? <ActivatePlanButton planId={p.id} /> : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PlanSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando plano">
      <Skeleton className="h-12 w-80" />
      <Skeleton className="h-20" />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Skeleton className="h-96" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}
