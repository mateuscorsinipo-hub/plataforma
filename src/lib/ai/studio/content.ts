import { z } from "zod";

import type { GenerationKind } from "@/lib/ai/studio/kinds";

/**
 * Conteúdo normalizado salvo em `ai_generations.content`. O mesmo esquema valida
 * o que vem do banco antes de renderizar (nada de confiar em JSON arbitrário).
 */
const text = (max: number) => z.string().max(max);

export const sectionSchema = z.object({ heading: text(300), body: text(40_000) });

export const questionOptionSchema = z.object({ id: text(20), text: text(2_000) });

export const normalizedQuestionSchema = z.object({
  type: z.enum(["multiple_choice", "true_false", "open"]),
  prompt: text(5_000),
  options: z.array(questionOptionSchema).max(6),
  correctOptionId: text(20).nullable(),
  referenceAnswer: text(5_000).nullable(),
  explanation: text(5_000),
  difficulty: z.enum(["easy", "medium", "hard"]),
  topic: text(120),
});

export type NormalizedQuestion = z.infer<typeof normalizedQuestionSchema>;

export const generationContentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.enum(["summary_quick", "summary_detailed"]),
    title: text(160),
    overview: text(4_000),
    sections: z.array(sectionSchema).max(60),
    keyPoints: z.array(text(1_000)).max(40),
  }),
  z.object({
    kind: z.literal("study_guide"),
    title: text(160),
    objectives: z.array(text(1_000)).max(30),
    sections: z.array(sectionSchema.extend({ checkQuestions: z.array(text(1_000)).max(10) })).max(40),
    tips: z.array(text(1_000)).max(20),
  }),
  z.object({
    kind: z.literal("key_concepts"),
    title: text(160),
    concepts: z.array(z.object({ term: text(200), explanation: text(4_000), example: text(2_000) })).max(60),
  }),
  z.object({
    kind: z.literal("glossary"),
    title: text(160),
    terms: z.array(z.object({ term: text(200), definition: text(2_000) })).max(120),
  }),
  z.object({
    kind: z.literal("flashcards"),
    title: text(160),
    cards: z.array(z.object({ front: text(2_000), back: text(4_000), hint: text(500) })).max(200),
  }),
  z.object({
    kind: z.literal("quiz"),
    title: text(160),
    questions: z.array(normalizedQuestionSchema).max(100),
  }),
  z.object({
    kind: z.literal("mock_exam"),
    title: text(160),
    durationMinutes: z.number().int().min(5).max(600),
    instructions: text(2_000),
    questions: z.array(normalizedQuestionSchema).max(120),
  }),
  z.object({
    kind: z.literal("essay_questions"),
    title: text(160),
    questions: z
      .array(z.object({ prompt: text(5_000), expectedPoints: z.array(text(1_000)).max(12), modelAnswer: text(8_000) }))
      .max(30),
  }),
  z.object({
    kind: z.literal("explanation"),
    title: text(160),
    explanation: text(40_000),
    examples: z.array(text(4_000)).max(12),
    commonMistakes: z.array(text(2_000)).max(12),
    practice: z.array(z.object({ question: text(2_000), answer: text(4_000) })).max(12),
  }),
]);

export type GenerationContent = z.infer<typeof generationContentSchema>;

export function parseStoredContent(value: unknown): GenerationContent | null {
  const parsed = generationContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function isDocumentKind(kind: GenerationKind): boolean {
  return kind !== "flashcards" && kind !== "quiz" && kind !== "mock_exam";
}
