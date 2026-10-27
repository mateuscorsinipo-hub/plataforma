"use server";

import { refresh } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { getUserTimezone } from "@/lib/billing/entitlements";
import { loadEventsInRange } from "@/lib/data/calendar";
import { addDays, localTimeString, zonedTimeToUtc } from "@/lib/domain/dates";
import { expandOccurrences, findConflicts } from "@/lib/domain/recurrence";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { eventSchema, type EventInput } from "@/lib/validation/calendar";

type SaveResult = { ok: true } | { ok: false; error: string; conflicts?: string[] };

/**
 * Cria ou edita um evento (a série inteira, quando recorrente). Antes de salvar,
 * avisa sobre choques de horário com outros eventos; o estudante pode confirmar.
 */
export async function saveEvent(eventId: string | null, raw: EventInput, options: { confirmConflicts?: boolean } = {}): Promise<SaveResult> {
  const user = await requireUser("/app/calendario");
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const input = parsed.data;
  const id = eventId ? uuidSchema.safeParse(eventId) : null;
  if (id && !id.success) return { ok: false, error: "Evento inválido." };
  const timezone = await getUserTimezone(user.id);

  const startsAt = zonedTimeToUtc(input.date, input.allDay ? "00:00" : input.startTime, timezone);
  const endsAt = input.allDay ? zonedTimeToUtc(input.date, "23:59", timezone) : zonedTimeToUtc(input.date, input.endTime, timezone);
  const weekdays = input.recurrence === "weekly" || input.recurrence === "biweekly" ? input.weekdays : [];

  if (!input.allDay && !options.confirmConflicts) {
    // Confere a primeira ocorrência e as próximas semanas de uma série recorrente.
    const horizon = input.recurrence === "none" ? endsAt : zonedTimeToUtc(addDays(input.date, 35), "23:59", timezone);
    const existing = await loadEventsInRange(new Date(startsAt.getTime() - 86_400_000), new Date(horizon.getTime() + 86_400_000));
    const slots = existing.map(({ row, occ }) => ({ eventId: row.id, title: row.title, start: occ.start, end: occ.end, allDay: row.all_day }));
    const candidates = expandOccurrences(
      {
        id: "novo",
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        timezone,
        allDay: false,
        recurrence: input.recurrence,
        recurrenceWeekdays: weekdays.length ? weekdays : null,
        recurrenceUntil: input.until,
      },
      startsAt,
      new Date(horizon.getTime() + 1),
    );
    const conflicts = new Map<string, string>();
    for (const occurrence of candidates) {
      for (const slot of findConflicts({ start: occurrence.start, end: occurrence.end, allDay: false, ignoreEventId: id?.data }, slots)) {
        conflicts.set(slot.eventId, `${slot.title} (${localTimeString(timezone, slot.start)})`);
      }
    }
    if (conflicts.size) {
      return { ok: false, error: "Este horário coincide com outros eventos.", conflicts: [...conflicts.values()].slice(0, 5) };
    }
  }

  const values = {
    title: input.title,
    description: input.description || null,
    event_type: input.eventType,
    subject_id: input.subjectId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    all_day: input.allDay,
    timezone,
    recurrence: input.recurrence,
    recurrence_weekdays: weekdays.length ? weekdays : null,
    recurrence_until: input.recurrence === "none" ? null : input.until,
    reminder_minutes: input.reminderMinutes,
    location: input.location || null,
  };
  const supabase = await createSupabaseServerClient();
  const { error } = id
    ? await supabase.from("calendar_events").update(values).eq("id", id.data)
    : await supabase.from("calendar_events").insert({ ...values, user_id: user.id });
  if (error) return { ok: false, error: "Não foi possível salvar o evento." };
  refresh();
  return { ok: true };
}

export async function deleteEvent(eventId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser("/app/calendario");
  const id = uuidSchema.safeParse(eventId);
  if (!id.success) return { ok: false, error: "Evento inválido." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("calendar_events").delete().eq("id", id.data).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível excluir o evento." };
  refresh();
  return { ok: true };
}
