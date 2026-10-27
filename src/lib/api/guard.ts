import "server-only";

import { getCurrentProfile, getSessionUser, type ProfileRow, type SessionUser } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env/public";

export function jsonError(status: number, error: string, extra: Record<string, unknown> = {}): Response {
  return Response.json({ error, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Proteção contra CSRF nas rotas que usam o cookie de sessão: exige JSON e
 * origem igual à do site (ou `Sec-Fetch-Site: same-origin`).
 */
export function checkSameOrigin(request: Request): Response | null {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return jsonError(415, "Formato de requisição inválido.");
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return jsonError(403, "Origem não permitida.");
  }
  const origin = request.headers.get("origin");
  if (origin) {
    const allowed = new Set([new URL(publicEnv.siteUrl).origin, new URL(request.url).origin]);
    if (!allowed.has(origin)) return jsonError(403, "Origem não permitida.");
  }
  return null;
}

export type StudentContext = { user: SessionUser; profile: ProfileRow };

/** Estudante autenticado, com conta ativa e onboarding concluído. */
export async function requireApiStudent(): Promise<{ ok: true; ctx: StudentContext } | { ok: false; response: Response }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, response: jsonError(401, "Sua sessão expirou. Entre novamente.") };
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, response: jsonError(401, "Sua sessão expirou. Entre novamente.") };
  if (profile.account_status !== "active") {
    return { ok: false, response: jsonError(403, "Sua conta não está ativa para usar este recurso.") };
  }
  if (!profile.onboarding_completed_at) {
    return { ok: false, response: jsonError(403, "Conclua a configuração inicial da conta para continuar.") };
  }
  return { ok: true, ctx: { user, profile } };
}

export async function readJson(request: Request, maxBytes = 256 * 1024): Promise<unknown> {
  const text = await request.text();
  if (text.length > maxBytes) throw new Error("payload_too_large");
  return JSON.parse(text);
}
