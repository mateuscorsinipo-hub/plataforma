import "server-only";

import { isAIConfigured, isServiceRoleConfigured, serverEnv } from "@/lib/env/server";
import { anthropicProvider } from "@/lib/ai/providers/anthropic";
import { openAICompatibleProvider } from "@/lib/ai/providers/openai-compatible";
import { AIError, type AIProvider } from "@/lib/ai/types";

/**
 * Ponto único de acesso ao modelo. Nenhuma página ou rota chama SDKs de IA
 * diretamente: tudo passa por aqui para trocar de provedor só por variável de ambiente.
 */
export function getAIProvider(): AIProvider {
  if (!isAIConfigured()) throw new AIError("not_configured");
  return serverEnv.ai.provider === "openai_compatible" ? openAICompatibleProvider : anthropicProvider;
}

export type AIAvailability = { available: true } | { available: false; reason: "no_provider" | "no_server_key" };

/** A IA só funciona com provedor configurado e chave secreta do Supabase (para registrar consumo). */
export function aiAvailability(): AIAvailability {
  if (!isAIConfigured()) return { available: false, reason: "no_provider" };
  if (!isServiceRoleConfigured()) return { available: false, reason: "no_server_key" };
  return { available: true };
}

export function aiSupportsImages(): boolean {
  if (!isAIConfigured()) return false;
  return getAIProvider().supportsImages;
}
