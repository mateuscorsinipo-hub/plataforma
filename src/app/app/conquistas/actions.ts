"use server";

import { refresh } from "next/cache";

import { getCurrentProfile, getSessionUser } from "@/lib/auth/session";
import { getUserTimezone } from "@/lib/billing/entitlements";
import { loadWeeklyActivity } from "@/lib/data/engagement";
import { challengeProgress, challengeSourceId, challengesForWeek } from "@/lib/domain/challenges";
import { addDays, localDateString, weekStart } from "@/lib/domain/dates";
import { isServiceRoleConfigured } from "@/lib/env/server";
import { achievementTitles, recordProgress } from "@/lib/progress/record";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Result = { ok: true; xp: number; achievements: string[] } | { ok: false; error: string };

/**
 * Resgata a recompensa de um desafio da semana. O progresso é recalculado aqui, com
 * os dados do banco; o XP é idempotente (um resgate por desafio por semana).
 */
export async function claimWeeklyChallenge(code: string): Promise<Result> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sua sessão expirou. Entre de novo." };
  const profile = await getCurrentProfile();
  if (!profile || profile.account_status !== "active") return { ok: false, error: "Sua conta não pode resgatar recompensas agora." };
  if (!isServiceRoleConfigured()) return { ok: false, error: "Recompensas indisponíveis nesta instalação." };

  const timezone = await getUserTimezone(user.id);
  const today = localDateString(timezone);
  const monday = weekStart(today);
  const supabase = await createSupabaseServerClient();
  const { data: prefs } = await supabase.from("user_preferences").select("daily_goal_minutes").eq("user_id", user.id).maybeSingle();
  const challenge = challengesForWeek(monday, { dailyGoalMinutes: prefs?.daily_goal_minutes ?? 30 }).find((c) => c.code === code);
  if (!challenge) return { ok: false, error: "Este desafio não é desta semana." };

  const activity = await loadWeeklyActivity(monday, addDays(monday, 6), timezone);
  if (!challengeProgress(challenge, activity).done) return { ok: false, error: "O desafio ainda não foi concluído." };

  const result = await recordProgress({
    userId: user.id,
    timezone,
    xp: {
      amount: challenge.reward,
      sourceType: "weekly_challenge",
      sourceId: challengeSourceId(monday, challenge.code),
      reason: `Desafio da semana: ${challenge.title}`,
    },
  });
  if (result.xpAwarded <= 0) return { ok: false, error: "A recompensa deste desafio já foi resgatada." };
  refresh();
  return { ok: true, xp: result.xpAwarded, achievements: await achievementTitles(result.unlocked) };
}
