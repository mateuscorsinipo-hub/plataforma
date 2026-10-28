import { expandOccurrences, type RecurringEvent } from "@/lib/domain/recurrence";

export type ReminderEvent = RecurringEvent & { userId: string; title: string; reminderMinutes: number };

export type DueReminder = { event: ReminderEvent; occurrenceStart: Date; remindAt: Date };

/** Janela de tolerância: a rotina roda a cada ~10 min; um atraso de até 30 min ainda avisa. */
export const REMINDER_GRACE_MS = 30 * 60 * 1000;

/**
 * Ocorrências cujo horário de aviso já chegou (e não passou da tolerância), sem
 * avisar de eventos que já começaram. A deduplicação fica no banco (reminder_deliveries).
 */
export function dueReminders(events: ReminderEvent[], now: Date, graceMs = REMINDER_GRACE_MS): DueReminder[] {
  const out: DueReminder[] = [];
  const from = new Date(now.getTime() - graceMs);
  for (const event of events) {
    const lead = event.reminderMinutes * 60_000;
    // Ocorrências que começam entre agora e agora + antecedência (mais a tolerância).
    for (const occurrence of expandOccurrences(event, from, new Date(now.getTime() + lead + graceMs))) {
      const remindAt = new Date(occurrence.start.getTime() - lead);
      if (remindAt <= now && remindAt > from && occurrence.start > now) {
        out.push({ event, occurrenceStart: occurrence.start, remindAt });
      }
    }
  }
  return out;
}

/** Texto curto de quando o evento começa, no fuso do evento. */
export function reminderWhen(start: Date, timezone: string, now: Date): string {
  const minutes = Math.round((start.getTime() - now.getTime()) / 60_000);
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(start);
  if (minutes <= 60) return `Começa em ${Math.max(1, minutes)} min (às ${time}).`;
  const day = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "short", timeZone: timezone }).format(start);
  return `Começa ${day}, às ${time}.`;
}
