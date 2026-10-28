import "server-only";

import { addDays } from "@/lib/domain/dates";
import { leagueLabel } from "@/lib/domain/gamification";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Limpeza diária: dados expirados, envios abandonados, imagens órfãs do chat e avisos antigos. */
export async function runCleanup() {
  const admin = createSupabaseAdminClient();
  const [{ data: expired, error: expiredError }, { data: orphans, error: orphanError }, { data: notifications }] = await Promise.all([
    admin.rpc("purge_expired_data"),
    admin.rpc("purge_orphan_uploads", { p_older_than: "1 day" }),
    admin.rpc("purge_old_notifications"),
  ]);
  if (expiredError || orphanError) throw new Error(`cleanup_failed:${expiredError?.code ?? orphanError?.code}`);
  const paths = (orphans ?? []).map((o) => o.storage_path);
  let removed = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { data } = await admin.storage.from("uploads").remove(batch);
    removed += data?.length ?? 0;
  }
  return { expired, orphanFiles: paths.length, storageObjectsRemoved: removed, oldNotifications: notifications ?? 0 };
}

/** Virada da liga da semana que terminou; avisa quem subiu ou desceu. Idempotente no banco. */
export async function runLeagueRollover() {
  const admin = createSupabaseAdminClient();
  const { data: current, error: weekError } = await admin.rpc("leaderboard_week_start");
  if (weekError || !current) throw new Error(`week_failed:${weekError?.code ?? "empty"}`);
  const previous = addDays(current, -7);
  const { data: changes, error } = await admin.rpc("run_league_rollover", { p_week_start: previous });
  if (error) throw new Error(`rollover_failed:${error.code}`);
  const order = ["bronze", "prata", "ouro", "platina", "diamante"];
  const notices = (changes ?? []).map((c) => {
    const up = order.indexOf(c.new_league) > order.indexOf(c.old_league);
    return {
      user_id: c.user_id,
      type: "league_change",
      title: up ? `Você subiu para a liga ${leagueLabel(c.new_league)}!` : `Você está na liga ${leagueLabel(c.new_league)} nesta semana`,
      body: up ? "Ótima semana de estudos. A nova liga já começou." : "Nova semana, nova chance de subir.",
      link: "/app/conquistas#liga",
    };
  });
  for (let i = 0; i < notices.length; i += 500) await admin.from("notifications").insert(notices.slice(i, i + 500));
  return { week: previous, changed: notices.length };
}
