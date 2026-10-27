import "server-only";

import { addDays, formatDateBR, localDateString, zonedTimeToUtc } from "@/lib/domain/dates";
import { getSubjectMap } from "@/lib/data/subjects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const periods = [7, 30, 90] as const;
export type Period = (typeof periods)[number];

/** Indicadores do período, todos calculados a partir dos dados gravados (nada estimado). */
export async function loadPerformance(period: Period, timezone: string) {
  const today = localDateString(timezone);
  const from = addDays(today, -(period - 1));
  const supabase = await createSupabaseServerClient();
  const [daily, subjects, weak, reviews, subjectMap] = await Promise.all([
    supabase.rpc("stats_daily", { p_from: from, p_to: today, p_tz: timezone }),
    supabase.rpc("stats_subjects", { p_from: from, p_to: today, p_tz: timezone }),
    supabase.rpc("stats_weak_topics", { p_limit: 8 }),
    supabase
      .from("flashcard_reviews")
      .select("rating")
      .gte("reviewed_at", zonedTimeToUtc(from, "00:00", timezone).toISOString())
      .limit(20_000),
    getSubjectMap(),
  ]);

  const days = (daily.data ?? []).map((d) => ({
    day: d.day,
    label: formatDateBR(d.day, { day: "2-digit", month: "2-digit" }),
    fullLabel: formatDateBR(d.day, { weekday: "short", day: "2-digit", month: "long" }),
    minutes: d.study_minutes,
    reviews: d.reviews,
    quizzes: d.quizzes,
    xp: d.xp,
  }));
  const totals = days.reduce(
    (acc, d) => ({ minutes: acc.minutes + d.minutes, reviews: acc.reviews + d.reviews, quizzes: acc.quizzes + d.quizzes, xp: acc.xp + d.xp }),
    { minutes: 0, reviews: 0, quizzes: 0, xp: 0 },
  );
  const activeDays = days.filter((d) => d.minutes > 0 || d.reviews > 0 || d.quizzes > 0).length;
  const subjectRows = (subjects.data ?? [])
    .map((s) => ({
      subjectId: s.subject_id,
      name: subjectMap.get(s.subject_id)?.name ?? "Matéria",
      answered: s.answered,
      correct: s.correct,
      accuracy: s.answered ? Math.round((s.correct / s.answered) * 100) : null,
      minutes: s.study_minutes,
    }))
    .sort((a, b) => (b.answered || 0) - (a.answered || 0));
  const answered = subjectRows.reduce((sum, s) => sum + s.answered, 0);
  const correct = subjectRows.reduce((sum, s) => sum + s.correct, 0);
  const ratings = reviews.data ?? [];
  const remembered = ratings.filter((r) => r.rating >= 3).length;

  return {
    from,
    today,
    days,
    totals,
    activeDays,
    accuracy: answered ? Math.round((correct / answered) * 100) : null,
    answered,
    retention: ratings.length ? Math.round((remembered / ratings.length) * 100) : null,
    reviewsCount: ratings.length,
    subjects: subjectRows,
    weakTopics: (weak.data ?? []).map((w) => ({
      topic: w.topic,
      subjectName: w.subject_id ? (subjectMap.get(w.subject_id)?.name ?? null) : null,
      answered: w.answered,
      correct: w.correct,
      accuracy: Math.round(Number(w.accuracy) * 100),
    })),
  };
}
