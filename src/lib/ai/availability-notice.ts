import "server-only";

import { aiAvailability, aiSupportsImages } from "@/lib/ai";
import { getStaffRoles } from "@/lib/auth/session";

export type AIStatus = { available: boolean; supportsImages: boolean; notice: string | null };

/**
 * Estado da IA para a interface. Estudantes veem um aviso simples; a equipe vê
 * o que falta configurar (nomes de variáveis, nunca valores).
 */
export async function getAIStatus(): Promise<AIStatus> {
  const availability = aiAvailability();
  if (availability.available) return { available: true, supportsImages: aiSupportsImages(), notice: null };
  const roles = await getStaffRoles();
  const staffHint =
    availability.reason === "no_provider"
      ? "Para ativar, defina ANTHROPIC_API_KEY (ou AI_PROVIDER=openai_compatible com OPENAI_API_KEY e AI_MODEL) nas variáveis de ambiente do servidor."
      : "Para ativar, defina SUPABASE_SECRET_KEY nas variáveis de ambiente do servidor (necessária para registrar o consumo).";
  return {
    available: false,
    supportsImages: false,
    notice: roles.length
      ? `Os recursos de IA estão desativados nesta instalação. ${staffHint}`
      : "Os recursos de IA ainda não foram configurados nesta instalação. Enquanto isso, você pode usar flashcards, quizzes, plano de estudos e a biblioteca.",
  };
}
