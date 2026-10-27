import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader, Skeleton } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { getUserTimezone } from "@/lib/billing/entitlements";
import { loadCalendarMonth } from "@/lib/data/calendar";
import { getSubjects } from "@/lib/data/subjects";
import { addDays, formatDateBR, localDateString } from "@/lib/domain/dates";
import { isEmailConfigured } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { CalendarView } from "./_components/calendar-view";

export const metadata: Metadata = { title: "Calendário" };

export default function CalendarPage({ searchParams }: PageProps<"/app/calendario">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Organizar" title="Calendário" description="Provas, aulas e sessões de estudo, com as tarefas do seu plano em cada dia." />
      <Suspense
        fallback={
          <div className="grid gap-6 xl:grid-cols-[1fr_22rem]" aria-busy="true" aria-label="Carregando calendário">
            <Skeleton className="h-[34rem]" />
            <Skeleton className="h-64" />
          </div>
        }
      >
        <Calendar searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function Calendar({ searchParams }: { searchParams: PageProps<"/app/calendario">["searchParams"] }) {
  const { user } = await requireStudent("/app/calendario");
  const params = await searchParams;
  const timezone = await getUserTimezone(user.id);
  const today = localDateString(timezone);
  const requested = typeof params.mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mes) ? params.mes : today.slice(0, 7);
  const supabase = await createSupabaseServerClient();
  const [{ gridStart, days, events }, subjects, { data: prefs }] = await Promise.all([
    loadCalendarMonth(requested, timezone),
    getSubjects(),
    supabase.from("user_preferences").select("email_reminders").eq("user_id", user.id).maybeSingle(),
  ]);

  const weeks = Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(gridStart, w * 7 + d);
      return {
        date,
        label: Number(date.slice(8, 10)),
        inMonth: date.startsWith(requested),
        isToday: date === today,
        events: days[date]?.events ?? [],
        tasks: days[date]?.tasks ?? [],
      };
    }),
  );
  const labels = Object.fromEntries(
    weeks.flat().map((d) => [d.date, formatDateBR(d.date, { weekday: "long", day: "2-digit", month: "long" }).replace(/^./, (c) => c.toUpperCase())]),
  );

  return (
    <CalendarView
      key={requested}
      monthLabel={formatDateBR(`${requested}-01`, { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase())}
      prevHref={`/app/calendario?mes=${shiftMonth(requested, -1)}`}
      nextHref={`/app/calendario?mes=${shiftMonth(requested, 1)}`}
      todayHref="/app/calendario"
      weeks={weeks}
      initialSelected={requested === today.slice(0, 7) ? today : `${requested}-01`}
      selectedLabels={labels}
      events={events}
      subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
      emailReminders={Boolean(prefs?.email_reminders) && isEmailConfigured()}
    />
  );
}
