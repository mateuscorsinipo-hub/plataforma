import { z } from "zod";

import { optionalText } from "@/lib/validation/common";

const prompt = z.string().trim().min(1, "Escreva o enunciado.").max(5000, "O enunciado pode ter até 5.000 caracteres.");
const explanation = z.string().trim().max(5000).optional().default("");
const topic = z.string().trim().max(120).optional().default("");
const points = z.number().min(0.5).max(100).optional().default(1);

export const questionInputSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("multiple_choice"),
      prompt,
      options: z
        .array(z.string().trim().min(1, "Alternativa vazia.").max(2000))
        .min(2, "Inclua pelo menos 2 alternativas.")
        .max(6, "Use no máximo 6 alternativas."),
      correctIndex: z.number().int().min(0),
      explanation,
      topic,
      points,
    })
    .refine((q) => q.correctIndex < q.options.length, { message: "Marque a alternativa correta.", path: ["correctIndex"] })
    .refine((q) => new Set(q.options.map((o) => o.toLowerCase())).size === q.options.length, {
      message: "As alternativas precisam ser diferentes.",
      path: ["options"],
    }),
  z.object({ type: z.literal("true_false"), prompt, correct: z.boolean(), explanation, topic, points }),
  z.object({
    type: z.literal("open"),
    prompt,
    referenceAnswer: z.string().trim().min(1, "Escreva a resposta esperada (usada na correção).").max(5000),
    explanation,
    topic,
    points,
  }),
]);

export type QuestionInput = z.infer<typeof questionInputSchema>;

export const quizSchema = z.object({
  title: z.string().trim().min(1, "Dê um título.").max(160, "Use no máximo 160 caracteres."),
  description: optionalText(1000),
  subjectId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => v || null),
  kind: z.enum(["quiz", "mock_exam"]).default("quiz"),
  durationMinutes: z.coerce.number().int().min(5, "Mínimo de 5 minutos.").max(600, "Máximo de 10 horas.").optional(),
});

const OPTION_IDS = ["a", "b", "c", "d", "e", "f"] as const;

/** Converte a entrada do editor para as colunas de quiz_questions. */
export function questionToRow(input: QuestionInput) {
  const base = {
    type: input.type,
    prompt: input.prompt,
    explanation: input.explanation || null,
    topic: input.topic || null,
    points: input.points,
  };
  if (input.type === "multiple_choice") {
    return {
      ...base,
      options: input.options.map((text, index) => ({ id: OPTION_IDS[index]!, text })),
      correct_option_id: OPTION_IDS[input.correctIndex]!,
      reference_answer: null,
    };
  }
  if (input.type === "true_false") {
    return {
      ...base,
      options: [
        { id: "true", text: "Verdadeiro" },
        { id: "false", text: "Falso" },
      ],
      correct_option_id: input.correct ? "true" : "false",
      reference_answer: null,
    };
  }
  return { ...base, options: [], correct_option_id: null, reference_answer: input.referenceAnswer };
}
