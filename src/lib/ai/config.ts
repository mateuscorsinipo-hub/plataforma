import type { Effort } from "@/lib/ai/types";

/**
 * Esforço de raciocínio e limite de saída por tarefa. O esforço controla a
 * profundidade do raciocínio do modelo (e o custo); tarefas de estudo que exigem
 * correção conceitual usam "medium" ou mais.
 */
export const aiTasks = {
  tutorChat: { effort: "medium", maxTokens: 8000 },
  conversationTitle: { effort: "low", maxTokens: 300, tier: "light" },
  conversationSummary: { effort: "low", maxTokens: 2000 },
  ocr: { effort: "low", maxTokens: 6000 },
  condenseNotes: { effort: "low", maxTokens: 4000 },
  summaryQuick: { effort: "medium", maxTokens: 4000 },
  summaryDetailed: { effort: "medium", maxTokens: 12000 },
  studyGuide: { effort: "medium", maxTokens: 12000 },
  keyConcepts: { effort: "medium", maxTokens: 8000 },
  glossary: { effort: "medium", maxTokens: 8000 },
  flashcards: { effort: "medium", maxTokens: 16000 },
  quiz: { effort: "medium", maxTokens: 16000 },
  mockExam: { effort: "high", maxTokens: 32000 },
  essayQuestions: { effort: "medium", maxTokens: 8000 },
  explanation: { effort: "medium", maxTokens: 8000 },
  grading: { effort: "high", maxTokens: 3000 },
  planTopics: { effort: "medium", maxTokens: 6000 },
} as const satisfies Record<string, { effort: Effort; maxTokens: number; tier?: "main" | "light" }>;

export type AITaskName = keyof typeof aiTasks;

/** Orçamento de texto de fonte enviado ao modelo (caracteres ≈ 3,6 por token em português). */
export const contextBudget = {
  /** Trechos de documentos anexados a uma pergunta do tutor. */
  tutorSourceChars: 24_000,
  /** Histórico de conversa reenviado a cada mensagem. */
  tutorHistoryChars: 30_000,
  /** Acima disto, o estúdio condensa o material por partes antes de gerar. */
  directGenerationChars: 90_000,
  /** Tamanho de cada grupo de trechos condensado em paralelo. */
  condenseGroupChars: 40_000,
  maxCondenseGroups: 16,
} as const;

/** Preços por milhão de tokens (US$), para estimativa interna de custo. Revise ao trocar de modelo. */
export const modelPricing: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25 },
};

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.6);
}
