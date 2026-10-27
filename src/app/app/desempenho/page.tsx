import { ChartColumnIcon, TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ColumnChart } from "@/components/charts/column-chart";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { getUserTimezone } from "@/lib/billing/entitlements";
import { loadPerformance, periods, type Period } from "@/lib/data/performance";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Desempenho" };

export default function PerformancePage({ searchParams }: PageProps<"/app/desempenho">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Organizar" title="Desempenho" description="Seu tempo de estudo, revisões e acertos, calculados a partir do que você fez no Grifo." />
      <Suspense
        fallback={
          <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando desempenho">
            <Skeleton className="h-10 w-72" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </div>
            <Skeleton className="h-64" />
          </div>
        }
      >
        <Performance searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="gap-1 p-4 sm:p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-extrabold sm:text-3xl">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

async function Performance({ searchParams }: { searchParams: PageProps<"/app/desempenho">["searchParams"] }) {
  const { user } = await requireStudent("/app/desempenho");
  const params = await searchParams;
  const requested = Number(params.periodo);
  const period: Period = (periods as readonly number[]).includes(requested) ? (requested as Period) : 30;
  const data = await loadPerformance(period, await getUserTimezone(user.id));
  const empty = data.totals.minutes === 0 && data.totals.reviews === 0 && data.totals.quizzes === 0 && data.answered === 0;

  return (
    <>
      <nav aria-label="Período" className="flex flex-wrap gap-2">
        {periods.map((p) => (
          <Link
            key={p}
            href={`/app/desempenho?periodo=${p}`}
            aria-current={p === period ? "page" : undefined}
            className={cn(
              "rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
              p === period ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-card hover:bg-muted",
            )}
          >
            Últimos {p} dias
          </Link>
        ))}
      </nav>

      {empty ? (
        <EmptyState
          icon={ChartColumnIcon}
          title="Ainda não há dados neste período"
          description="Revise flashcards, faça quizzes ou use o cronômetro de foco. Seus números aparecem aqui conforme você estuda."
          action={
            <Link href="/app/flashcards" className="font-semibold text-primary hover:underline">
              Começar pelos flashcards
            </Link>
          }
        />
      ) : (
        <>
          <section aria-label="Resumo do período" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatTile label="Tempo de estudo registrado" value={formatMinutes(data.totals.minutes)} hint={`${data.activeDays} ${data.activeDays === 1 ? "dia ativo" : "dias ativos"} de ${period}`} />
            <StatTile label="Flashcards revisados" value={data.totals.reviews.toLocaleString("pt-BR")} hint={data.retention !== null ? `Lembrou de ${data.retention}% dos cartões` : undefined} />
            <StatTile label="Quizzes e simulados" value={data.totals.quizzes.toLocaleString("pt-BR")} hint={`${data.totals.xp.toLocaleString("pt-BR")} XP no período`} />
            <StatTile label="Acertos nas questões" value={data.accuracy !== null ? `${data.accuracy}%` : "—"} hint={data.answered ? `${data.answered} questões corrigidas` : "Nenhuma questão corrigida"} />
          </section>

          <section aria-label="Atividade por dia" className="grid gap-4 lg:grid-cols-3">
            <Card className="gap-2">
              <CardHeader>
                <CardTitle className="text-base">Minutos de estudo por dia</CardTitle>
                <CardDescription>Revisões, quizzes, simulados e cronômetro de foco.</CardDescription>
              </CardHeader>
              <ColumnChart
                data={data.days.map((d) => ({ label: d.label, fullLabel: d.fullLabel, value: d.minutes }))}
                unit="min"
                ariaLabel={`Minutos de estudo por dia nos últimos ${period} dias. Total: ${data.totals.minutes} minutos.`}
              />
            </Card>
            <Card className="gap-2">
              <CardHeader>
                <CardTitle className="text-base">Flashcards revisados por dia</CardTitle>
                <CardDescription>Cada revisão conta uma vez.</CardDescription>
              </CardHeader>
              <ColumnChart
                data={data.days.map((d) => ({ label: d.label, fullLabel: d.fullLabel, value: d.reviews }))}
                unit="cartões"
                ariaLabel={`Flashcards revisados por dia. Total: ${data.totals.reviews}.`}
              />
            </Card>
            <Card className="gap-2">
              <CardHeader>
                <CardTitle className="text-base">Quizzes e simulados por dia</CardTitle>
                <CardDescription>Tentativas entregues.</CardDescription>
              </CardHeader>
              <ColumnChart
                data={data.days.map((d) => ({ label: d.label, fullLabel: d.fullLabel, value: d.quizzes }))}
                unit="entregues"
                ariaLabel={`Quizzes e simulados entregues por dia. Total: ${data.totals.quizzes}.`}
              />
            </Card>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Acertos por matéria</CardTitle>
                <CardDescription>Questões corrigidas no período. Matérias sem questões mostram só o tempo de estudo.</CardDescription>
              </CardHeader>
              {data.subjects.length ? (
                <ul className="flex flex-col gap-3">
                  {data.subjects.map((s) => (
                    <li key={s.subjectId} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {s.accuracy !== null ? `${s.accuracy}% · ${s.correct}/${s.answered}` : "sem questões"} · {formatMinutes(s.minutes)}
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${s.accuracy ?? 0}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Associe seus baralhos e quizzes a uma matéria para ver o desempenho por matéria.</p>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TriangleAlertIcon className="size-4 text-warning-text" aria-hidden="true" /> Pontos para reforçar
                </CardTitle>
                <CardDescription>Temas com menos de 70% de acertos nos últimos 60 dias (mínimo de 3 questões).</CardDescription>
              </CardHeader>
              {data.weakTopics.length ? (
                <ul className="flex flex-col divide-y divide-border">
                  {data.weakTopics.map((w) => (
                    <li key={`${w.subjectName}-${w.topic}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{w.topic}</span>
                        {w.subjectName ? <span className="text-xs text-muted-foreground">{w.subjectName}</span> : null}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {w.correct}/{w.answered} · {w.accuracy}%
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum tema abaixo de 70% por enquanto.</p>
              )}
            </Card>
          </div>

          <details className="rounded-2xl border border-border bg-card p-5">
            <summary className="cursor-pointer text-sm font-semibold">Ver os dados em tabela</summary>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Atividade diária nos últimos {period} dias</caption>
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-semibold">Dia</th>
                    <th scope="col" className="py-2 pr-4 text-right font-semibold">Minutos</th>
                    <th scope="col" className="py-2 pr-4 text-right font-semibold">Flashcards</th>
                    <th scope="col" className="py-2 pr-4 text-right font-semibold">Quizzes</th>
                    <th scope="col" className="py-2 text-right font-semibold">XP</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.days].reverse().map((d) => (
                    <tr key={d.day} className="border-b border-border last:border-b-0">
                      <th scope="row" className="py-2 pr-4 text-left font-medium">
                        {d.fullLabel}
                      </th>
                      <td className="py-2 pr-4 text-right tabular-nums">{d.minutes}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{d.reviews}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{d.quizzes}</td>
                      <td className="py-2 text-right tabular-nums">{d.xp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </>
  );
}
