import "server-only";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";

import { serverEnv } from "@/lib/env/server";

/** IP do cliente informado pela plataforma de hospedagem (primeiro valor de x-forwarded-for). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "0.0.0.0";
  return ip.slice(0, 64);
}

export async function getUserAgent(): Promise<string> {
  const h = await headers();
  return (h.get("user-agent") ?? "").slice(0, 300);
}

/**
 * Hash com segredo (HMAC-SHA256). Usado para chaves anônimas: não guardamos IPs.
 * Sem APP_HASH_SECRET configurado, usa um valor derivado da chave secreta do Supabase.
 */
export function keyedHash(value: string): string {
  const secret = serverEnv.appHashSecret || `fallback:${serverEnv.supabaseSecretKey}`;
  return createHmac("sha256", secret).update(value).digest("hex");
}

/** Chave anônima diária de visitante: muda todo dia e não permite recuperar o IP. */
export async function anonymousVisitorKey(day: string): Promise<string> {
  const [ip, ua] = await Promise.all([getClientIp(), getUserAgent()]);
  return `anon:${keyedHash(`${day}|${ip}|${ua}`).slice(0, 40)}`;
}

const BOT_PATTERN = /bot|crawler|spider|crawling|preview|facebookexternalhit|whatsapp|slurp|headless/i;

export async function isLikelyBot(): Promise<boolean> {
  return BOT_PATTERN.test(await getUserAgent());
}
