import "server-only";

import { isServiceRoleConfigured } from "@/lib/env/server";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RateLimitRule = { limit: number; windowSeconds: number };

/** Regras centralizadas de limite de requisições por ação sensível. */
export const rateLimits = {
  contactForm: { limit: 5, windowSeconds: 3600 },
  signUp: { limit: 8, windowSeconds: 3600 },
  signIn: { limit: 20, windowSeconds: 900 },
  passwordReset: { limit: 5, windowSeconds: 3600 },
  aiChat: { limit: 30, windowSeconds: 60 },
  aiGeneration: { limit: 10, windowSeconds: 60 },
  upload: { limit: 30, windowSeconds: 600 },
  report: { limit: 20, windowSeconds: 3600 },
  materialView: { limit: 120, windowSeconds: 600 },
  guardianInvite: { limit: 3, windowSeconds: 86400 },
  publish: { limit: 20, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * Janela fixa persistida no Postgres (funciona com várias instâncias serverless).
 * Falha fechada em produção se o banco não responder; em desenvolvimento sem
 * chave secreta, libera e registra um aviso.
 */
export async function checkRateLimit(key: string, rule: RateLimitRule): Promise<boolean> {
  if (!isServiceRoleConfigured()) {
    if (process.env.NODE_ENV !== "production") return true;
    logger.error("rate_limit.unconfigured", { scope: key.split(":")[0] });
    return false;
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("check_rate_limit", {
    p_key: key,
    p_limit: rule.limit,
    p_window_seconds: rule.windowSeconds,
  });
  if (error) {
    logger.error("rate_limit.error", { scope: key.split(":")[0], code: error.code });
    return process.env.NODE_ENV !== "production";
  }
  return data === true;
}
