import "server-only";

import { addDays, dateRange, weekStart } from "@/lib/domain/dates";
import { rankRecommendations } from "@/lib/domain/recommendations";
import type { ShellData } from "@/lib/data/shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;

/** Tudo que o painel inicial mostra, lido do banco com o cliente do usuário (RLS). */
export async function loadDashboard(shell: ShellData) {
  const supabase = await createSupabaseServerClient();
  const { userId, today, timezone } = shell;
  const monday = weekStart(today);
  const sunday = addDays(monday, 6);
  const nowIso = new Date().toISOString();

  const [
    prefs,
    weekly,
    dueCards,
    todayTasks,
    activePlans,
    exams,
    recentXp,
    weakTopics,
    mySubjects,
    subjectStats,
    totals,
  ] = await Promise.all([
    supabase.from("user_preferences").select("daily_goal_minutes, study_weekdays").eq("user_id", userId).maybeSingle(),
    supabase.rpc("stats_daily", { p_from: monday, p_to: sunday, p_tz: timezone }),
    supabase
      .from("flashcards")
      .select("deck_id", { count: "exact" })
      .eq("user_id", userId)
      .eq("suspended", false)
      .lte("due_at", nowIso)
      .limit(500),
    supabase
      .from("study_plan_tasks")
      .select("id, title, task_type, subject_id, topic, estimated_minutes, priority, status, plan_id, link_type, link_id")
      .eq("user_id", userId)
      .eq("scheduled_date", today)
      .order("status")
      .order("priority")
      .order("position"),
    supabase
      .from("study_plans")
      .select("id, title, exam_date, exam_type")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("exam_date")
      .limit(3),
    supabase
      .from("calendar_events")
      .select("id, title, starts_at, subject_id, timezone")
      .eq("user_id", userId)
      .eq("event_type", "exam")
      .gte("ends_at", nowIso)
      .order("starts_at")
      .limit(3),
    supabase.from("xp_transactions").select("id, amount, reason, source_type, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
    supabase.rpc("stats_weak_topics", { p_limit: 3 }),
    supabase.from("user_subjects").select("subject_id").eq("user_id", userId),
    supabase.rpc("stats_subjects", { p_from: addDays(today, -29), p_to: today, p_tz: timezone }),
    supabase.from("xp_transactions").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  const week = dateRange(monday, sunday).map((day) => {
    const row = (weekly.data ?? []).find((r) => r.day === day);
    return { day, minutes: row?.study_minutes ?? 0, isToday: day === today, isFuture: day > today };
  });
  const todayMinutes = week.find((d) => d.isToday)?.minutes ?? 0;
  const dueDecks = new Set((dueCards.data ?? []).map((row) => row.deck_id)).size;

  const statsBySubject = new Map((subjectStats.data ?? []).map((row) => [row.subject_id, row]));
  const followedSubjects = (mySubjects.data ?? []).map((row) => {
    const stat = statsBySubject.get(row.subject_id);
    return {
      subjectId: row.subject_id,
      answered: stat?.answered ?? 0,
      accuracy: stat && stat.answered > 0 ? Math.round((stat.correct / stat.answered) * 100) : null,
      minutes: stat?.study_minutes ?? 0,
    };
  });

  return {
    dailyGoal: prefs.data?.daily_goal_minutes ?? 30,
    todayMinutes,
    week,
    weekMinutes: week.reduce((sum, d) => sum + d.minutes, 0),
    dueCount: dueCards.count ?? 0,
    dueDecks,
    todayTasks: todayTasks.data ?? [],
    activePlans: activePlans.data ?? [],
    exams: exams.data ?? [],
    recentXp: recentXp.data ?? [],
    weakTopics: weakTopics.data ?? [],
    followedSubjects,
    isNewUser: (totals.count ?? 0) === 0,
  };
}

/**
 * Materiais recomendados: candidatos publicados nas matérias seguidas, ordenados pelas
 * regras de src/lib/domain/recommendations (temas com mais erros, série, etapa, avaliação).
 */
export async function loadRecommendations(params: {
  userId: string;
  subjectIds: string[];
  schoolStage: string | null;
  gradeYear: number | null;
  weakTopics: { subject_id: string | null; topic: string }[];
}) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("study_materials")
    .select("id, slug, title, subject_id, material_type, school_stage, grade_year, topic, tags, saves_count, favorites_count, rating_sum, rating_count")
    .eq("status", "published")
    .eq("visibility", "public")
    .neq("author_id", params.userId)
    .order("saves_count", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(30);
  if (params.subjectIds.length) query = query.in("subject_id", params.subjectIds);
  const [{ data }, { data: saved }] = await Promise.all([
    query,
    supabase.from("material_saves").select("material_id").eq("user_id", params.userId).limit(1000),
  ]);
  const candidates = (data ?? []).map((m) => ({
    ...m,
    subjectId: m.subject_id,
    schoolStage: m.school_stage,
    gradeYear: m.grade_year,
    saves: m.saves_count + m.favorites_count,
    ratingAverage: m.rating_count ? m.rating_sum / m.rating_count : null,
    ratingCount: m.rating_count,
  }));
  return rankRecommendations(candidates, {
    weakTopics: params.weakTopics.map((w) => ({ subjectId: w.subject_id, topic: w.topic })),
    schoolStage: params.schoolStage,
    gradeYear: params.gradeYear,
    excludeIds: new Set((saved ?? []).map((s) => s.material_id)),
  });
}
