import { z } from "zod";

import { optionalText } from "@/lib/validation/common";

export const deckSchema = z.object({
  title: z.string().trim().min(1, "Dê um nome ao baralho.").max(120, "Use no máximo 120 caracteres."),
  description: optionalText(500),
  subjectId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => v || null),
});

export const cardSchema = z.object({
  front: z.string().trim().min(1, "Escreva a frente do cartão.").max(2000, "A frente pode ter até 2.000 caracteres."),
  back: z.string().trim().min(1, "Escreva o verso do cartão.").max(4000, "O verso pode ter até 4.000 caracteres."),
  explanation: optionalText(4000),
});

export type DeckInput = z.infer<typeof deckSchema>;
export type CardInput = z.infer<typeof cardSchema>;
