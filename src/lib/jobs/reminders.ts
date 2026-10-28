import "server-only";

import { addDays, localDateString, localHour, safeTimezone } from "@/lib/domain/dates";
import { dueReminders, reminderWhen, type ReminderEvent } from "@/lib/domain/reminders";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email/send";
import { isEmailConfigured } from "@/lib/env/server";
import { publicEnv } from "@/lib/env/public";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_EVENTS = 5000;

/** Lembretes do calendário: aviso no app e, se a pessoa pediu e o e-mail está configurado, por e-mail. */
export async function sendCalendarReminders(now = new Date()) {
  const admin = createSupabaseAdminClient();
  const horizon = new Date(now.getTime() + 8 * 86_400_000).toISOString();
  const yesterday = addDays(localDateString("America/Sao_Paulo", now), -1);
  const { data: rows, error } = await admin
    .from("calendar_events")
    .select("id, user_id, title, starts_at, ends_at, timezone, all_day, recurrence, recurrence_weekdays, recurrence_until, reminder_minutes")
    .not("reminder_minutes", "is", null)
    .lte("starts_at", horizon)
    .or(`and(recurrence.eq.none,starts_at.gte.${new Date(now.getTime() - 86_400_000).toISOString()}),and(recurrence.neq.none,or(recurrence_until.is.null,recurrence_until.gte.${yesterday}))`)
    .limit(MAX_EVENTS);
  if (error) throw new Error(`reminders_query_failed:${error.code}`);

  const events: ReminderEvent[] = (rows ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    title: r.title,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    timezone: safeTimezone(r.timezone),
    allDay: r.all_day,
    recurrence: r.recurrence as ReminderEvent["recurrence"],
    recurrenceWeekdays: r.recurrence_weekdays,
    recurrenceUntil: r.recurrence_until,
    reminderMinutes: r.reminder_minutes ?? 0,
  }));
  const due = dueReminders(events, now);
  if (!due.length) return { due: 0, inApp: 0, emails: 0 };

  // Só contas ativas recebem avisos; e-mail só para quem ligou a opção.
  const userIds = [...new Set(due.map((d) => d.event.userId))];
  const [{ data: profiles }, { data: prefs }] = await Promise.all([
    admin.from("profiles").select("id, account_status").in("id", userIds),
    admin.from("user_preferences").select("user_id, email_reminders").in("user_id", userIds),
  ]);
  const active = new Set((profiles ?? []).filter((p) => p.account_status === "active").map((p) => p.id));
  const wantsEmail = new Set((prefs ?? []).filter((p) => p.email_reminders).map((p) => p.user_id));
  const emailOn = isEmailConfigured();

  let inApp = 0;
  let emails = 0;
  for (const reminder of due) {
    const { event } = reminder;
    if (!active.has(event.userId)) continue;
    const occurrenceAt = reminder.occurrenceStart.toISOString();
    const when = reminderWhen(reminder.occurrenceStart, event.timezone, now);

    const { data: claimed } = await admin
      .from("reminder_deliveries")
      .upsert({ event_id: event.id, occurrence_at: occurrenceAt, channel: "in_app" }, { onConflict: "event_id,occurrence_at,channel", ignoreDuplicates: true })
      .select("event_id");
    if (claimed?.length) {
      await admin.from("notifications").insert({ user_id: event.userId, type: "calendar_reminder", title: `Lembrete: ${event.title}`.slice(0, 120), body: when, link: "/app/calendario" });
      inApp += 1;
    }

    if (emailOn && wantsEmail.has(event.userId)) {
      const { data: emailClaim } = await admin
        .from("reminder_deliveries")
        .upsert({ event_id: event.id, occurrence_at: occurrenceAt, channel: "email" }, { onConflict: "event_id,occurrence_at,channel", ignoreDuplicates: true })
        .select("event_id");
      if (!emailClaim?.length) continue;
      const { data: authUser } = await admin.auth.admin.getUserById(event.userId);
      const to = authUser?.user?.email;
      const result = to
        ? await sendEmail({
            to,
            subject: `Lembrete: ${event.title}`,
            text: `${event.title}\n${when}\n\nVer no calendário: ${publicEnv.siteUrl}/app/calendario\n\nVocê recebe este e-mail porque ativou lembretes por e-mail nas configurações.`,
            html: emailLayout(
              `Lembrete: ${event.title}`,
              `<p style="margin:0 0 16px;font-size:16px">${escapeHtml(when)}</p><p style="margin:0 0 24px"><a href="${publicEnv.siteUrl}/app/calendario" style="color:#2453E6;font-weight:bold">Abrir o calendário</a></p><p style="margin:0;font-size:12px;color:#5B6785">Você recebe este e-mail porque ativou lembretes por e-mail nas configurações do Grifo.</p>`,
            ),
          })
        : { sent: false as const, reason: "provider_error" as const };
      if (result.sent) {
        emails += 1;
      } else {
        // Falhou: libera o envio para a próxima rodada (dentro da tolerância).
        await admin.from("reminder_deliveries").delete().eq("event_id", event.id).eq("occurrence_at", occurrenceAt).eq("channel", "email");
        logger.warn("reminders.email_failed", { reason: result.reason });
      }
    }
  }
  return { due: due.length, inApp, emails };
}

/**
 * "Sua sequência termina hoje": no início da noite (19h–21h no fuso da pessoa), para
 * quem tem 2+ dias de sequência e ainda não estudou hoje. No máximo um aviso por dia.
 */
export async function sendStreakRiskNotices(now = new Date()) {
  const admin = createSupabaseAdminClient();
  const { data: stats } = await admin
    .from("user_stats")
    .select("user_id, current_streak, last_active_date")
    .gte("current_streak", 2)
    .gte("last_active_date", addDays(localDateString("UTC", now), -2))
    .limit(20_000);
  const candidates = stats ?? [];
  if (!candidates.length) return { notified: 0 };
  const ids = candidates.map((s) => s.user_id);
  const [{ data: prefs }, { data: profiles }, { data: recent }] = await Promise.all([
    admin.from("user_preferences").select("user_id, timezone").in("user_id", ids),
    admin.from("profiles").select("id, account_status").in("id", ids),
    admin.from("notifications").select("user_id").eq("type", "streak_risk").in("user_id", ids).gte("created_at", new Date(now.getTime() - 20 * 3_600_000).toISOString()),
  ]);
  const tzBy = new Map((prefs ?? []).map((p) => [p.user_id, safeTimezone(p.timezone)]));
  const active = new Set((profiles ?? []).filter((p) => p.account_status === "active").map((p) => p.id));
  const alreadyWarned = new Set((recent ?? []).map((r) => r.user_id));

  const notices = candidates
    .filter((s) => active.has(s.user_id) && !alreadyWarned.has(s.user_id))
    .filter((s) => {
      const tz = tzBy.get(s.user_id) ?? "America/Sao_Paulo";
      const today = localDateString(tz, now);
      const hour = localHour(tz, now);
      return s.last_active_date === addDays(today, -1) && hour >= 19 && hour < 22;
    })
    .map((s) => ({
      user_id: s.user_id,
      type: "streak_risk",
      title: `Sua sequência de ${s.current_streak} dias termina hoje`,
      body: "Uma revisão rápida de flashcards já mantém a sequência.",
      link: "/app/flashcards/revisar",
    }));
  if (notices.length) await admin.from("notifications").insert(notices);
  return { notified: notices.length };
}
