import "server-only";

import { challengeProgress, challengeSourceId, challengesForWeek, type WeeklyActivity, type WeeklyChallenge } from "@/lib/domain/challenges";
import { addDays, daysBetween, localDateString, weekStart } from "@/lib/domain/dates";
import { effectiveStreak, levelProgress } from "@/lib/domain/gamification";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const emptyActivity: WeeklyActivity = {
  flashcard_reviews: 0,
  quizzes_completed: 0,
  mock_exams: 0,
  correct_answers: 0,
  study_minutes: 0,
  active_days: 0,
  focus_sessions: 0,
};

export async function loadWeeklyActivity(from: string, to: string, timezone: string): Promise<WeeklyActivity> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("weekly_activity", { p_from: from, p_to: to, p_tz: timezone });
  const row = data?.[0];
  return row ? { ...emptyActivity, ...row } : emptyActivity;
}

export type ChallengeView = WeeklyChallenge & { value: number; percent: number; done: boolean; claimed: boolean };

/** Desafios da semana do estudante (semana de segunda a domingo no fuso dele). */
export async function loadChallenges(userId: string, timezone: string) {
  const supabase = await createSupabaseServerClient();
  const today = localDateString(timezone);
  const monday = weekStart(today);
  const sunday = addDays(monday, 6);
  const [{ data: prefs }, activity, { data: claims }] = await Promise.all([
    supabase.from("user_preferences").select("daily_goal_minutes").eq("user_id", userId).maybeSingle(),
    loadWeeklyActivity(monday, sunday, timezone),
    supabase.from("xp_transactions").select("source_id").eq("user_id", userId).eq("source_type", "weekly_challenge").like("source_id", `${monday}:%`),
  ]);
  const claimed = new Set((claims ?? []).map((c) => c.source_id));
  const challenges: ChallengeView[] = challengesForWeek(monday, { dailyGoalMinutes: prefs?.daily_goal_minutes ?? 30 }).map((c) => ({
    ...c,
    ...challengeProgress(c, activity),
    claimed: claimed.has(challengeSourceId(monday, c.code)),
  }));
  return { weekStart: monday, daysLeft: daysBetween(today, sunday), challenges };
}

export type AchievementView = {
  code: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  threshold: number;
  xpReward: number;
  progress: number;
  unlockedAt: string | null;
};

export async function loadAchievements(): Promise<AchievementView[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("my_achievements");
  return (data ?? []).map((a) => ({
    code: a.code,
    title: a.title,
    description: a.description,
    icon: a.icon,
    category: a.category,
    threshold: a.threshold,
    xpReward: a.xp_reward,
    progress: a.progress,
    unlockedAt: a.unlocked_at,
  }));
}

export type LeaderboardRow = { rank: number; username: string; avatarUrl: string | null; level: number; xp: number; isMe: boolean };

/** Liga da semana: o ranking só mostra quem aceitou aparecer; o próprio usuário sempre se vê. */
export async function loadLeague() {
  const supabase = await createSupabaseServerClient();
  const [{ data: status }, { data: board }] = await Promise.all([
    supabase.rpc("my_league_status"),
    supabase.rpc("get_league_leaderboard", { p_limit: 30 }),
  ]);
  const me = status?.[0];
  return {
    league: me?.league ?? "bronze",
    weekStart: me?.week_start ?? null,
    xp: me?.xp ?? 0,
    rank: me?.rank === null || me?.rank === undefined ? null : Number(me.rank),
    members: Number(me?.members ?? 0),
    rows: (board ?? []).map(
      (r): LeaderboardRow => ({ rank: Number(r.rank), username: r.username, avatarUrl: r.avatar_url, level: r.level, xp: r.xp, isMe: r.is_me }),
    ),
  };
}

export type StreakDay = { day: string; minutes: number; xp: number; active: boolean; goalMet: boolean; isToday: boolean };

/** Sequência atual, recorde e as últimas 4 semanas, de segunda a domingo (calendário de constância). */
export async function loadStreak(userId: string, timezone: string) {
  const supabase = await createSupabaseServerClient();
  const today = localDateString(timezone);
  const from = addDays(weekStart(today), -21);
  const [{ data: stats }, { data: prefs }, { data: days }] = await Promise.all([
    supabase.from("user_stats").select("xp_total, current_streak, longest_streak, last_active_date").eq("user_id", userId).maybeSingle(),
    supabase.from("user_preferences").select("daily_goal_minutes").eq("user_id", userId).maybeSingle(),
    supabase.rpc("stats_daily", { p_from: from, p_to: today, p_tz: timezone }),
  ]);
  const goal = prefs?.daily_goal_minutes ?? 30;
  const xpTotal = stats?.xp_total ?? 0;
  return {
    today,
    goal,
    current: effectiveStreak(stats?.current_streak ?? 0, stats?.last_active_date ?? null, today),
    longest: stats?.longest_streak ?? 0,
    activeToday: stats?.last_active_date === today,
    level: levelProgress(xpTotal),
    xpTotal,
    days: (days ?? []).map(
      (d): StreakDay => ({
        day: d.day,
        minutes: d.study_minutes,
        xp: d.xp,
        // A sequência conta dias com XP (qualquer atividade concluída), como em award_xp.
        active: d.xp > 0 || d.study_minutes > 0,
        goalMet: d.study_minutes >= goal,
        isToday: d.day === today,
      }),
    ),
  };
}
