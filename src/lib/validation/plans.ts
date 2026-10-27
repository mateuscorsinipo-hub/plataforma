import { z } from "zod";

import { isValidDateString } from "@/lib/domain/dates";

export const planSchema = z.object({
  title: z.string().trim().min(1, "Dê um nome ao plano.").max(120),
  examType: z.enum(["enem", "vestibular", "school", "concurso", "other"]),
  examDate: z.string().refine(isValidDateString, "Data inválida."),
  dailyMinutes: z.coerce.number().int().min(15, "Mínimo de 15 minutos por dia.").max(720, "Máximo de 12 horas por dia."),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Escolha pelo menos um dia da semana."),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  subjects: z
    .array(
      z.object({
        subjectId: z.uuid(),
        weight: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        topics: z.array(z.string().trim().min(1).max(160)).max(30, "Use até 30 tópicos por matéria."),
      }),
    )
    .min(1, "Escolha pelo menos uma matéria.")
    .max(12, "Use no máximo 12 matérias por plano."),
});

export type PlanFormInput = z.infer<typeof planSchema>;

/** Tópicos digitados um por linha (ou separados por ponto e vírgula). */
export function parseTopics(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/\n|;/)
        .map((t) => t.replace(/^[-•*\d.)\s]+/, "").trim())
        .filter(Boolean),
    ),
  ].slice(0, 30);
}
