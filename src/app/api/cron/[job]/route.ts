import { timingSafeEqual } from "node:crypto";

import { isServiceRoleConfigured, serverEnv } from "@/lib/env/server";
import { runCleanup, runLeagueRollover } from "@/lib/jobs/maintenance";
import { sendCalendarReminders, sendStreakRiskNotices } from "@/lib/jobs/reminders";
import { logger } from "@/lib/logger";

export const maxDuration = 300;

const jobs: Record<string, () => Promise<unknown>> = {
  lembretes: async () => ({ calendar: await sendCalendarReminders(), streak: await sendStreakRiskNotices() }),
  limpeza: runCleanup,
  ligas: runLeagueRollover,
};

function authorized(request: Request): boolean {
  const secret = serverEnv.cronSecret;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Rotinas agendadas (Vercel Cron ou outro agendador). Exigem `Authorization: Bearer
 * CRON_SECRET`; sem o segredo configurado, ficam desligadas.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/cron/[job]">) {
  const { job } = await ctx.params;
  if (!serverEnv.cronSecret) return Response.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  if (!authorized(request)) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const run = jobs[job];
  if (!run) return Response.json({ error: "Rotina desconhecida." }, { status: 404 });
  if (!isServiceRoleConfigured()) return Response.json({ error: "Chave do servidor ausente." }, { status: 503 });
  const started = Date.now();
  try {
    const result = await run();
    logger.info("cron.done", { job, ms: Date.now() - started });
    return Response.json({ job, ok: true, result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    logger.error("cron.failed", { job, message });
    return Response.json({ job, ok: false, error: message }, { status: 500 });
  }
}
