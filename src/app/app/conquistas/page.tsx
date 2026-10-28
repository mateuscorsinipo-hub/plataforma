import { FlameIcon, ShieldIcon, SparklesIcon, TargetIcon, TrophyIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AchievementIcon } from "@/components/gamification/achievement-icon";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, Skeleton } from "@/components/ui/feedback";
import { Avatar, AvatarFallback, AvatarImage, Progress } from "@/components/ui/primitives";
import { requireStudent } from "@/lib/auth/session";
import { initialsOf, safeAvatarUrl } from "@/lib/avatar";
import { getUserTimezone } from "@/lib/billing/entitlements";
import { loadAchievements, loadChallenges, loadLeague, loadStreak, type StreakDay } from "@/lib/data/engagement";
import { addDays, weekdayLabel } from "@/lib/domain/dates";
import { leagueLabel, leagues, type LeagueId } from "@/lib/domain/gamification";
import { cn } from "@/lib/utils";

import { ChallengeList } from "./_components/challenge-list";

export const metadata: Metadata = { title: "Conquistas" };

export default function AchievementsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Organizar" title="Conquistas" description="Seu nível, a sequência de dias, os desafios da semana e a sua liga." />
      <Suspense
        fallback={
          <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando conquistas">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
            </div>
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        }
      >
        <Achievements />
      </Suspense>
    </div>
  );
}

const longDate = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function dayLabel(d: StreakDay): string {
  const date = longDate.format(new Date(`${d.day}T12:00:00Z`));
  if (!d.active) return `${date}: sem estudo`;
  return `${date}: ${d.minutes} min${d.goalMet ? ", meta cumprida" : ""}`;
}

function StreakCalendar({ days, today }: { days: StreakDay[]; today: string }) {
  // 4 semanas de segunda a domingo; dias futuros da semana atual aparecem vazios.
  const first = days[0]?.day ?? today;
  const cells = Array.from({ length: 28 }, (_, i) => {
    const day = addDays(first, i);
    return (
      days.find((d) => d.day === day) ?? {
        day,
        minutes: 0,
        xp: 0,
        active: false,
        goalMet: false,
        isToday: false,
        future: day > today,
      }
    );
  });
  return (
    <div className="flex flex-col gap-3">
      <div className="grid w-fit grid-cols-7 gap-1.5" role="list" aria-label="Últimas quatro semanas">
        {[1, 2, 3, 4, 5, 6, 0].map((w) => (
          <span key={w} className="text-center text-[0.6875rem] font-semibold text-muted-foreground" aria-hidden="true">
            {weekdayLabel(w).slice(0, 1).toUpperCase()}
          </span>
        ))}
        {cells.map((d) => {
          const future = "future" in d && d.future;
          return (
            <span
              key={d.day}
              role="listitem"
              aria-label={future ? `${longDate.format(new Date(`${d.day}T12:00:00Z`))}: ainda não chegou` : dayLabel(d)}
              title={future ? undefined : dayLabel(d)}
              className={cn(
                "size-8 rounded-lg sm:size-9",
                future ? "border border-dashed border-border" : d.goalMet ? "bg-primary" : d.active ? "bg-primary/30" : "bg-muted",
                d.day === today && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
              )}
            />
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-muted" aria-hidden="true" /> Sem estudo
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-primary/30" aria-hidden="true" /> Estudou
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-primary" aria-hidden="true" /> Meta cumprida
        </li>
      </ul>
    </div>
  );
}

async function Achievements() {
  const { user } = await requireStudent("/app/conquistas");
  const timezone = await getUserTimezone(user.id);
  const [streak, challenges, league, achievements] = await Promise.all([
    loadStreak(user.id, timezone),
    loadChallenges(user.id, timezone),
    loadLeague(),
    loadAchievements(),
  ]);
  const todayMinutes = streak.days.find((d) => d.isToday)?.minutes ?? 0;
  const goalPercent = Math.min(100, Math.round((todayMinutes / Math.max(1, streak.goal)) * 100));
  const unlocked = achievements.filter((a) => a.unlockedAt);
  const leagueColor = leagues[league.league as LeagueId]?.color ?? leagues.bronze.color;
  const xpToNext = streak.level.nextLevelXp - streak.xpTotal;
  const unlockedDate = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: timezone,
  });

  return (
    <>
      <section aria-label="Resumo" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <SparklesIcon className="size-4 text-primary" aria-hidden="true" /> Nível
          </p>
          <p className="font-display text-[2.1rem] leading-none font-extrabold">{streak.level.level}</p>
          <Progress value={streak.level.percent} aria-label={`Progresso para o nível ${streak.level.level + 1}: ${streak.level.percent}%`} />
          <p className="text-xs text-muted-foreground">
            {streak.xpTotal.toLocaleString("pt-BR")} XP · faltam {xpToNext.toLocaleString("pt-BR")} para o nível {streak.level.level + 1}
          </p>
        </Card>
        <Card className="gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <FlameIcon className={cn("size-4", streak.current > 0 ? "fill-streak text-streak" : "")} aria-hidden="true" /> Sequência
          </p>
          <p className="font-display text-[2.1rem] leading-none font-extrabold">
            {streak.current} <span className="text-base font-semibold text-muted-foreground">{streak.current === 1 ? "dia" : "dias"}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {streak.activeToday
              ? "Hoje já conta."
              : streak.current > 0
                ? "Conclua uma atividade hoje para não perder a sequência."
                : "Conclua uma atividade para começar."}{" "}
            Recorde: {streak.longest} {streak.longest === 1 ? "dia" : "dias"}.
          </p>
        </Card>
        <Card className="gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <TargetIcon className="size-4 text-primary" aria-hidden="true" /> Meta de hoje
          </p>
          <p className="font-display text-[2.1rem] leading-none font-extrabold">
            {todayMinutes} <span className="text-base font-semibold text-muted-foreground">de {streak.goal} min</span>
          </p>
          <Progress
            value={goalPercent}
            aria-label={`Meta diária: ${goalPercent}%`}
            indicatorClassName={goalPercent >= 100 ? "bg-success" : undefined}
          />
          <Link href="/app/configuracoes#preferencias" className="text-xs font-semibold text-primary hover:underline">
            Mudar a meta diária
          </Link>
        </Card>
        <Card className="gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <ShieldIcon className="size-4" style={{ color: leagueColor }} aria-hidden="true" /> Liga
          </p>
          <p className="font-display text-[2.1rem] leading-none font-extrabold">{leagueLabel(league.league)}</p>
          <p className="text-xs text-muted-foreground">
            {league.rank ? `${league.rank}º de ${league.members} nesta semana · ${league.xp} XP` : "Ganhe XP esta semana para entrar na disputa."}
          </p>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex-row flex-wrap items-baseline justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle>Desafios da semana</CardTitle>
            <CardDescription>Os mesmos para todo mundo; renovam toda segunda-feira.</CardDescription>
          </div>
          <span className="text-sm font-semibold text-muted-foreground">
            {challenges.daysLeft === 0 ? "Termina hoje" : `Termina em ${challenges.daysLeft} ${challenges.daysLeft === 1 ? "dia" : "dias"}`}
          </span>
        </CardHeader>
        <ChallengeList challenges={challenges.challenges} />
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Constância</CardTitle>
            <CardDescription>Dias com alguma atividade concluída nas últimas quatro semanas.</CardDescription>
          </CardHeader>
          <StreakCalendar days={streak.days} today={streak.today} />
        </Card>
        <Card id="liga" className="scroll-mt-24">
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2">
                <TrophyIcon className="size-5" style={{ color: leagueColor }} aria-hidden="true" /> Liga {leagueLabel(league.league)}
              </CardTitle>
              <CardDescription>
                XP ganho de segunda a domingo (horário de Brasília). Ao fim da semana, os 20% primeiros sobem de liga e, com 5 ou mais participantes,
                os 20% últimos descem.
              </CardDescription>
            </div>
            <Link href="/app/configuracoes#privacidade" className="text-sm font-semibold text-primary hover:underline">
              Privacidade no ranking
            </Link>
          </CardHeader>
          {league.rows.length ? (
            <ol className="flex flex-col divide-y divide-border">
              {league.rows.map((row) => {
                const avatar = safeAvatarUrl(row.avatarUrl);
                return (
                  <li
                    key={`${row.rank}-${row.username}`}
                    className={cn("flex items-center gap-3 px-1 py-2.5", row.isMe && "-mx-2 rounded-xl bg-secondary/70 px-3")}
                    aria-current={row.isMe ? "true" : undefined}
                  >
                    <span className="w-7 text-right font-display text-sm font-extrabold tabular-nums">{row.rank}º</span>
                    <Avatar className="size-8">
                      {avatar ? <AvatarImage src={avatar} alt="" /> : null}
                      <AvatarFallback className="text-[0.65rem]">{initialsOf(row.username)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      @{row.username}
                      {row.isMe ? <span className="ml-1.5 text-xs font-bold text-primary">você</span> : null}
                    </span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">nível {row.level}</span>
                    <span className="w-20 text-right text-sm font-bold tabular-nums">{row.xp.toLocaleString("pt-BR")} XP</span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="rounded-xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">
              Ninguém da sua liga ganhou XP nesta semana ainda. Revise flashcards ou faça um quiz para abrir o placar.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            No ranking aparecem só o @ e, para perfis públicos, a foto. Quem desativou “Aparecer no ranking da liga” não é listado.
          </p>
        </Card>
      </div>

      <section aria-labelledby="titulo-conquistas" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="titulo-conquistas" className="font-display text-xl font-bold">
            Conquistas
          </h2>
          <span className="text-sm text-muted-foreground">
            {unlocked.length} de {achievements.length} desbloqueadas
          </span>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {achievements.map((a) => {
            const done = Boolean(a.unlockedAt);
            const percent = Math.round((a.progress / Math.max(1, a.threshold)) * 100);
            return (
              <li key={a.code} className={cn("flex gap-3 rounded-2xl border bg-card p-4", done ? "border-primary/40" : "border-border")}>
                <span
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-2xl",
                    done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  <AchievementIcon name={a.icon} className="size-6" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-snug">{a.title}</p>
                    {a.xpReward ? <span className="shrink-0 text-xs font-bold text-muted-foreground">+{a.xpReward} XP</span> : null}
                  </div>
                  <p className="text-sm leading-snug text-muted-foreground">{a.description}</p>
                  {done ? (
                    <p className="text-xs font-semibold text-success-text">Desbloqueada em {unlockedDate.format(new Date(a.unlockedAt!))}</p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Progress value={percent} className="h-1.5" aria-label={`${a.title}: ${a.progress} de ${a.threshold}`} />
                      <span className="shrink-0 text-xs font-semibold text-ink-2 tabular-nums">
                        {a.progress.toLocaleString("pt-BR")}/{a.threshold.toLocaleString("pt-BR")}
                      </span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
