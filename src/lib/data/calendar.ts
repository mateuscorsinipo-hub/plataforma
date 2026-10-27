import "server-only";

import { addDays, localDateString, localTimeString, weekday, zonedTimeToUtc } from "@/lib/domain/dates";
import { expandOccurrences, type Recurrence, type RecurringEvent } from "@/lib/domain/recurrence";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EventRow = Database["public"]["Tables"]["calendar_events"]["Row"];

export function toRecurring(row: EventRow): RecurringEvent {
  return {
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    allDay: row.all_day,
    recurrence: row.recurrence as Recurrence,
    recurrenceWeekdays: row.recurrence_weekdays,
    recurrenceUntil: row.recurrence_until,
  };
}

/** Eventos (com ocorrências recorrentes) que tocam o intervalo [from, to). */
export async function loadEventsInRange(from: Date, to: Date) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("calendar_events")
    .select("*")
    .lt("starts_at", to.toISOString())
    .or(`ends_at.gte.${from.toISOString()},recurrence.neq.none`)
    .order("starts_at")
    .limit(1000);
  const rows = (data ?? []).filter((row) => !row.recurrence_until || row.recurrence_until >= localDateString(row.timezone, from));
  return rows.flatMap((row) => expandOccurrences(toRecurring(row), from, to).map((occ) => ({ row, occ })));
}

export type DayEvent = {
  key: string;
  eventId: string;
  title: string;
  type: string;
  time: string;
  subjectId: string | null;
  recurring: boolean;
  location: string | null;
};

export type DayTask = { id: string; title: string; status: string };

export type EventEditData = {
  id: string;
  title: string;
  description: string;
  eventType: string;
  subjectId: string;
  date: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  recurrence: string;
  weekdays: number[];
  until: string;
  reminderMinutes: string;
  location: string;
  fromPlan: boolean;
};

/** Grade do mês (6 semanas, começando no domingo) no fuso do estudante. */
export async function loadCalendarMonth(month: string, timezone: string) {
  const first = `${month}-01`;
  const gridStart = addDays(first, -weekday(first));
  const gridEnd = addDays(gridStart, 42);
  const from = zonedTimeToUtc(gridStart, "00:00", timezone);
  const to = zonedTimeToUtc(gridEnd, "00:00", timezone);
  const supabase = await createSupabaseServerClient();
  const [occurrences, { data: tasks }] = await Promise.all([
    loadEventsInRange(from, to),
    supabase
      .from("study_plan_tasks")
      .select("id, title, status, scheduled_date, study_plans!inner(status)")
      .eq("study_plans.status", "active")
      .gte("scheduled_date", gridStart)
      .lt("scheduled_date", gridEnd)
      .order("position")
      .limit(1500),
  ]);

  const days: Record<string, { events: DayEvent[]; tasks: DayTask[] }> = {};
  const ensure = (date: string) => (days[date] ??= { events: [], tasks: [] });
  const editData = new Map<string, EventEditData>();
  for (const { row, occ } of occurrences) {
    const date = localDateString(timezone, occ.start);
    const time = row.all_day ? "Dia inteiro" : `${localTimeString(timezone, occ.start)}–${localTimeString(timezone, occ.end)}`;
    ensure(date).events.push({
      key: `${row.id}:${occ.start.toISOString()}`,
      eventId: row.id,
      title: row.title,
      type: row.event_type,
      time,
      subjectId: row.subject_id,
      recurring: row.recurrence !== "none",
      location: row.location,
    });
    if (!editData.has(row.id)) {
      const start = new Date(row.starts_at);
      editData.set(row.id, {
        id: row.id,
        title: row.title,
        description: row.description ?? "",
        eventType: row.event_type,
        subjectId: row.subject_id ?? "",
        date: localDateString(row.timezone, start),
        allDay: row.all_day,
        startTime: localTimeString(row.timezone, start),
        endTime: localTimeString(row.timezone, new Date(row.ends_at)),
        recurrence: row.recurrence,
        weekdays: row.recurrence_weekdays ?? [],
        until: row.recurrence_until ?? "",
        reminderMinutes: row.reminder_minutes === null ? "" : String(row.reminder_minutes),
        location: row.location ?? "",
        fromPlan: Boolean(row.plan_id),
      });
    }
  }
  for (const task of tasks ?? []) ensure(task.scheduled_date).tasks.push({ id: task.id, title: task.title, status: task.status });
  for (const day of Object.values(days)) day.events.sort((a, b) => (a.time === "Dia inteiro" ? -1 : b.time === "Dia inteiro" ? 1 : a.time.localeCompare(b.time)));
  return { gridStart, days, events: Object.fromEntries(editData) };
}
