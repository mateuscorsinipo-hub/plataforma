import "server-only";

import { XP_RULES } from "@/lib/domain/gamification";
import { localDateString } from "@/lib/domain/dates";
import { isServiceRoleConfigured } from "@/lib/env/server";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ActivityType = "flashcards" | "quiz" | "mock_exam" | "tutor" | "studio" | "reading" | "plan_task" | "focus";

export type ProgressInput = {
  userId: string;
  timezone: string;
  xp?: { amount: number; sourceType: string; sourceId: string; reason: string; dailyCap?: number };
  session?: { activityType: ActivityType; sourceId: string; durationSeconds: number; subjectId?: string | null; endedAt?: Date };
};

export type ProgressResult = { xpAwarded: number; unlocked: string[]; dailyGoalReached: boolean };

/**
 * Registra o progresso de uma atividade já validada pelo servidor: XP (com teto
 * diário e idempotência por evento), sessão de estudo (minutos), meta diária e
 * conquistas. Falhas aqui nunca desfazem a atividade principal.
 */
export async function recordProgress(input: ProgressInput): Promise<ProgressResult> {
  const result: ProgressResult = { xpAwarded: 0, unlocked: [], dailyGoalReached: false };
  if (!isServiceRoleConfigured()) return result;
  const admin = createSupabaseAdminClient();
  const endedAt = input.session?.endedAt ?? new Date();
  const today = localDateString(input.timezone, endedAt);

  try {
    if (input.session) {
      const seconds = Math.min(14_400, Math.max(1, Math.round(input.session.durationSeconds)));
      const { error } = await admin.from("study_sessions").insert({
        user_id: input.userId,
        activity_type: input.session.activityType,
        subject_id: input.session.subjectId ?? null,
        source_id: input.session.sourceId,
        started_at: new Date(endedAt.getTime() - seconds * 1000).toISOString(),
        ended_at: endedAt.toISOString(),
        duration_seconds: seconds,
        local_date: today,
      });
      // 23505: a mesma atividade já foi registrada (repetição da requisição).
      if (error && error.code !== "23505") logger.warn("progress.session_failed", { code: error.code });
    }

    if (input.xp && input.xp.amount > 0) {
      const { data, error } = await admin.rpc("award_xp", {
        p_user_id: input.userId,
        p_amount: Math.round(input.xp.amount),
        p_source_type: input.xp.sourceType,
        p_source_id: input.xp.sourceId,
        p_reason: input.xp.reason.slice(0, 200),
        p_local_date: today,
        p_daily_cap: input.xp.dailyCap ?? undefined,
      });
      if (error) logger.warn("progress.xp_failed", { code: error.code });
      result.xpAwarded = data ?? 0;
    }

    // Meta diária: bônus uma vez por dia quando os minutos registrados alcançam a meta.
    if (input.session) {
      const [{ data: prefs }, { data: sessions }] = await Promise.all([
        admin.from("user_preferences").select("daily_goal_minutes").eq("user_id", input.userId).maybeSingle(),
        admin.from("study_sessions").select("duration_seconds").eq("user_id", input.userId).eq("local_date", today),
      ]);
      const goal = prefs?.daily_goal_minutes ?? 30;
      const minutes = (sessions ?? []).reduce((sum, s) => sum + s.duration_seconds, 0) / 60;
      if (minutes >= goal) {
        const { data: bonus } = await admin.rpc("award_xp", {
          p_user_id: input.userId,
          p_amount: XP_RULES.dailyGoalMet.amount,
          p_source_type: "daily_goal",
          p_source_id: today,
          p_reason: "Meta diária cumprida",
          p_local_date: today,
        });
        if (bonus && bonus > 0) {
          result.dailyGoalReached = true;
          result.xpAwarded += bonus;
          await admin.from("notifications").insert({
            user_id: input.userId,
            type: "daily_goal",
            title: "Meta do dia cumprida!",
            body: `Você estudou ${Math.round(minutes)} minutos hoje. +${bonus} XP.`,
            link: "/app/desempenho",
          });
        }
      }
    }

    const { data: unlocked, error: achievementsError } = await admin.rpc("check_achievements", {
      p_user_id: input.userId,
      p_local_date: today,
    });
    if (achievementsError) logger.warn("progress.achievements_failed", { code: achievementsError.code });
    result.unlocked = unlocked ?? [];
  } catch (error) {
    logger.error("progress.exception", { name: error instanceof Error ? error.name : "unknown" });
  }
  return result;
}

/** Nomes das conquistas liberadas (para o aviso na tela). */
export async function achievementTitles(codes: string[]): Promise<string[]> {
  if (!codes.length) return [];
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("achievements").select("code, title").in("code", codes);
  return (data ?? []).map((a) => a.title);
}
