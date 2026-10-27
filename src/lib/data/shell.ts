import "server-only";

import { cache } from "react";

import { getCurrentProfile, getSessionUser, getStaffRoles } from "@/lib/auth/session";
import { localDateString, safeTimezone } from "@/lib/domain/dates";
import { effectiveStreak, levelProgress } from "@/lib/domain/gamification";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ShellData = {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  timezone: string;
  today: string;
  xpTotal: number;
  level: number;
  levelPercent: number;
  streak: number;
  league: string;
  unreadNotifications: number;
  isStaff: boolean;
};

/** Dados do cabeçalho do app, lidos uma vez por requisição. */
export const getShellData = cache(async (): Promise<ShellData | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  const [profile, statsResult, prefsResult, unreadResult, roles] = await Promise.all([
    getCurrentProfile(),
    supabase.from("user_stats").select("xp_total, level, current_streak, last_active_date, league").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_preferences").select("timezone").eq("user_id", user.id).maybeSingle(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
    getStaffRoles(),
  ]);
  if (!profile) return null;

  const timezone = safeTimezone(prefsResult.data?.timezone);
  const today = localDateString(timezone);
  const xpTotal = statsResult.data?.xp_total ?? 0;
  const progress = levelProgress(xpTotal);

  return {
    userId: user.id,
    displayName: profile.display_name || profile.username,
    username: profile.username,
    avatarUrl: profile.avatar_url,
    timezone,
    today,
    xpTotal,
    level: progress.level,
    levelPercent: progress.percent,
    streak: effectiveStreak(statsResult.data?.current_streak ?? 0, statsResult.data?.last_active_date ?? null, today),
    league: statsResult.data?.league ?? "bronze",
    unreadNotifications: unreadResult.count ?? 0,
    isStaff: roles.length > 0,
  };
});
