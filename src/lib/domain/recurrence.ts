import { addDays, daysBetween, localDateString, localTimeString, weekday, weekStart, zonedTimeToUtc } from "@/lib/domain/dates";

/**
 * Expansão de eventos recorrentes do calendário no fuso do evento, mantendo a hora
 * local (ex.: aula às 19h toda terça continua às 19h mesmo se o fuso mudar de horário).
 */
export type Recurrence = "none" | "daily" | "weekly" | "biweekly" | "monthly";

export type RecurringEvent = {
  id: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  allDay: boolean;
  recurrence: Recurrence;
  recurrenceWeekdays: number[] | null;
  recurrenceUntil: string | null;
};

export type Occurrence = { eventId: string; start: Date; end: Date; localDate: string };

const MAX_OCCURRENCES = 800;

function matches(event: RecurringEvent, firstDate: string, date: string): boolean {
  if (date < firstDate) return false;
  if (event.recurrenceUntil && date > event.recurrenceUntil) return false;
  switch (event.recurrence) {
    case "none":
      return date === firstDate;
    case "daily":
      return true;
    case "weekly":
    case "biweekly": {
      const days = event.recurrenceWeekdays?.length ? event.recurrenceWeekdays : [weekday(firstDate)];
      if (!days.includes(weekday(date))) return false;
      if (event.recurrence === "weekly") return true;
      const weeks = Math.floor(daysBetween(weekStart(firstDate), weekStart(date)) / 7);
      return weeks % 2 === 0;
    }
    case "monthly":
      return date.slice(8, 10) === firstDate.slice(8, 10);
  }
}

/** Ocorrências que encostam no intervalo [from, to), em instantes UTC. */
export function expandOccurrences(event: RecurringEvent, from: Date, to: Date): Occurrence[] {
  const start = new Date(event.startsAt);
  const duration = Math.max(0, new Date(event.endsAt).getTime() - start.getTime());
  const firstDate = localDateString(event.timezone, start);
  const time = localTimeString(event.timezone, start);
  if (event.recurrence === "none") {
    const end = new Date(start.getTime() + duration);
    return end >= from && start < to ? [{ eventId: event.id, start, end, localDate: firstDate }] : [];
  }
  const out: Occurrence[] = [];
  // Começa um dia antes do intervalo para pegar eventos que atravessam a meia-noite.
  let date = localDateString(event.timezone, new Date(Math.max(from.getTime() - 86_400_000 - duration, start.getTime())));
  const lastDate = localDateString(event.timezone, to);
  for (let guard = 0; date <= lastDate && guard < 1500 && out.length < MAX_OCCURRENCES; guard++, date = addDays(date, 1)) {
    if (!matches(event, firstDate, date)) continue;
    const occStart = zonedTimeToUtc(date, time, event.timezone);
    const occEnd = new Date(occStart.getTime() + duration);
    if (occEnd >= from && occStart < to) out.push({ eventId: event.id, start: occStart, end: occEnd, localDate: date });
  }
  return out;
}

export type TimedSlot = { eventId: string; title: string; start: Date; end: Date; allDay: boolean };

/** Eventos com horário que se sobrepõem ao intervalo proposto (eventos de dia inteiro não conflitam). */
export function findConflicts(candidate: { start: Date; end: Date; allDay: boolean; ignoreEventId?: string }, slots: TimedSlot[]): TimedSlot[] {
  if (candidate.allDay) return [];
  return slots.filter(
    (slot) => !slot.allDay && slot.eventId !== candidate.ignoreEventId && slot.start < candidate.end && candidate.start < slot.end,
  );
}
