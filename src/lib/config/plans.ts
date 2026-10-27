/**
 * Configuração central de planos e limites. É o ÚNICO lugar com números comerciais:
 * páginas, rotas de IA e uploads leem daqui. Ajuste os valores conforme o custo real
 * do provedor de IA e a estratégia do produto.
 */
export type PlanId = "free" | "pro";

export type UsageFeature = "ai_chat_message" | "ai_generation" | "file_processing" | "ai_grading";

export type UsageWindow = "day" | "month";

export type FeatureLimit = { limit: number; window: UsageWindow };

export type PlanDefinition = {
  id: PlanId;
  name: string;
  tagline: string;
  limits: Record<UsageFeature, FeatureLimit>;
  maxUploadBytes: number;
  maxSourcesPerSession: number;
  maxQuestionsPerQuiz: number;
  maxMockExamQuestions: number;
  maxFlashcardsPerGeneration: number;
  maxSourceCharsPerGeneration: number;
};

const MB = 1024 * 1024;

export const plans: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Grátis",
    tagline: "Para o estudo do dia a dia",
    limits: {
      ai_chat_message: { limit: 15, window: "day" },
      ai_generation: { limit: 8, window: "month" },
      file_processing: { limit: 10, window: "month" },
      ai_grading: { limit: 3, window: "month" },
    },
    maxUploadBytes: 10 * MB,
    maxSourcesPerSession: 3,
    maxQuestionsPerQuiz: 20,
    maxMockExamQuestions: 30,
    maxFlashcardsPerGeneration: 30,
    maxSourceCharsPerGeneration: 120_000,
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Mais IA e arquivos maiores",
    limits: {
      ai_chat_message: { limit: 150, window: "day" },
      ai_generation: { limit: 120, window: "month" },
      file_processing: { limit: 150, window: "month" },
      ai_grading: { limit: 60, window: "month" },
    },
    maxUploadBytes: 50 * MB,
    maxSourcesPerSession: 10,
    maxQuestionsPerQuiz: 50,
    maxMockExamQuestions: 90,
    maxFlashcardsPerGeneration: 80,
    maxSourceCharsPerGeneration: 600_000,
  },
};

export const featureLabels: Record<UsageFeature, string> = {
  ai_chat_message: "Mensagens com o tutor",
  ai_generation: "Gerações no estúdio",
  file_processing: "Arquivos processados",
  ai_grading: "Correções de dissertativas",
};

/** Linhas da tabela comparativa exibida na landing e na página de planos. */
export function comparisonRows(): { label: string; free: string; pro: string }[] {
  const f = plans.free;
  const p = plans.pro;
  const per = (l: FeatureLimit) => `${l.limit} por ${l.window === "day" ? "dia" : "mês"}`;
  return [
    { label: "Biblioteca da comunidade", free: "Completa", pro: "Completa" },
    { label: "Flashcards, quizzes, plano e calendário", free: "Sem limite", pro: "Sem limite" },
    { label: featureLabels.ai_chat_message, free: per(f.limits.ai_chat_message), pro: per(p.limits.ai_chat_message) },
    { label: featureLabels.ai_generation, free: per(f.limits.ai_generation), pro: per(p.limits.ai_generation) },
    { label: featureLabels.file_processing, free: per(f.limits.file_processing), pro: per(p.limits.file_processing) },
    { label: featureLabels.ai_grading, free: per(f.limits.ai_grading), pro: per(p.limits.ai_grading) },
    { label: "Tamanho máximo por arquivo", free: `${f.maxUploadBytes / MB} MB`, pro: `${p.maxUploadBytes / MB} MB` },
    { label: "Fontes por sessão de IA", free: String(f.maxSourcesPerSession), pro: String(p.maxSourcesPerSession) },
    { label: "Questões por simulado", free: `até ${f.maxMockExamQuestions}`, pro: `até ${p.maxMockExamQuestions}` },
  ];
}

export function formatPriceBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/** Chave do período de consumo no fuso do usuário: "d:2026-10-27" ou "m:2026-10". */
export function usagePeriodKey(window: UsageWindow, localDate: string): string {
  return window === "day" ? `d:${localDate}` : `m:${localDate.slice(0, 7)}`;
}
