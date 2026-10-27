import { z } from "zod";

import type { GenerationKind } from "@/lib/ai/studio/kinds";

/**
 * Esquemas de SAÍDA pedidos ao modelo (sem transformações, para virar JSON Schema).
 * Tudo é obrigatório: "nenhum" é representado por string vazia ou lista vazia.
 * Regras de conteúdo (alternativas, gabarito, quantidade) são conferidas em normalize.ts.
 */
const section = z.object({
  heading: z.string().describe("Título curto da seção"),
  body: z.string().describe("Conteúdo da seção em Markdown (listas, negrito, tabelas e LaTeX entre $...$ quando útil)"),
});

const summary = z.object({
  title: z.string().describe("Título do resumo"),
  overview: z.string().describe("Visão geral em 2 a 4 frases"),
  sections: z.array(section),
  keyPoints: z.array(z.string()).describe("Pontos essenciais para memorizar, uma frase cada"),
});

const studyGuide = z.object({
  title: z.string(),
  objectives: z.array(z.string()).describe("O que o estudante deve saber ao final"),
  sections: z.array(
    section.extend({ checkQuestions: z.array(z.string()).describe("1 a 3 perguntas para checar a compreensão da seção") }),
  ),
  tips: z.array(z.string()).describe("Dicas práticas de estudo e de prova sobre este conteúdo"),
});

const keyConcepts = z.object({
  title: z.string(),
  concepts: z.array(
    z.object({
      term: z.string(),
      explanation: z.string().describe("Explicação clara em 2 a 5 frases"),
      example: z.string().describe("Exemplo concreto; string vazia se não houver"),
    }),
  ),
});

const glossary = z.object({
  title: z.string(),
  terms: z.array(z.object({ term: z.string(), definition: z.string().describe("Definição em 1 a 3 frases") })),
});

const flashcards = z.object({
  title: z.string(),
  cards: z.array(
    z.object({
      front: z.string().describe("Pergunta ou conceito, curto e específico"),
      back: z.string().describe("Resposta direta e correta"),
      hint: z.string().describe("Dica curta que ajuda a lembrar; string vazia se não houver"),
    }),
  ),
});

const question = z.object({
  type: z.enum(["multiple_choice", "true_false", "open"]),
  prompt: z.string().describe("Enunciado completo da questão"),
  options: z
    .array(z.string())
    .describe("Em múltipla escolha: 4 ou 5 alternativas sem letras no início. Nos outros tipos: lista vazia"),
  correctOption: z.number().int().describe("Múltipla escolha: índice (0 = primeira) da única alternativa correta. Outros tipos: -1"),
  correctBoolean: z.boolean().nullable().describe("Verdadeiro ou falso: a resposta correta. Outros tipos: null"),
  expectedAnswer: z.string().describe("Questão aberta: o que uma resposta completa deve conter. Outros tipos: string vazia"),
  explanation: z.string().describe("Explicação do gabarito: por que a resposta está certa e as outras erradas"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  topic: z.string().describe("Tópico específico avaliado, em poucas palavras"),
});

const quiz = z.object({ title: z.string(), questions: z.array(question) });

const mockExam = z.object({
  title: z.string(),
  durationMinutes: z.number().int().describe("Tempo sugerido de prova em minutos"),
  instructions: z.string().describe("Instruções curtas para quem vai fazer o simulado"),
  questions: z.array(question),
});

const essayQuestions = z.object({
  title: z.string(),
  questions: z.array(
    z.object({
      prompt: z.string(),
      expectedPoints: z.array(z.string()).describe("Pontos que uma resposta completa deve abordar"),
      modelAnswer: z.string().describe("Resposta modelo em Markdown"),
    }),
  ),
});

const explanation = z.object({
  title: z.string(),
  explanation: z.string().describe("Explicação passo a passo em Markdown, do básico ao mais complexo"),
  examples: z.array(z.string()).describe("Exemplos resolvidos ou situações concretas, em Markdown"),
  commonMistakes: z.array(z.string()).describe("Erros comuns e como evitá-los"),
  practice: z.array(z.object({ question: z.string(), answer: z.string() })).describe("Exercícios curtos com resposta"),
});

export const outputSchemas = {
  summary_quick: summary,
  summary_detailed: summary,
  study_guide: studyGuide,
  key_concepts: keyConcepts,
  glossary,
  flashcards,
  quiz,
  mock_exam: mockExam,
  essay_questions: essayQuestions,
  explanation,
} satisfies Record<GenerationKind, z.ZodType>;

export type RawOutput<K extends GenerationKind> = z.infer<(typeof outputSchemas)[K]>;
export type RawQuestion = z.infer<typeof question>;
