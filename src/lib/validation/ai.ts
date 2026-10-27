import { z } from "zod";

import { generationKinds, type GenerationKind } from "@/lib/ai/studio/kinds";

const kindValues = generationKinds.map((k) => k.kind) as [GenerationKind, ...GenerationKind[]];

export const generateRequestSchema = z.object({
  kind: z.enum(kindValues),
  fileIds: z.array(z.uuid()).min(1, "Escolha pelo menos um arquivo.").max(20),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  length: z.enum(["short", "medium", "long"]).default("medium"),
  count: z.number().int().min(1).max(200).optional(),
  focus: z.string().trim().max(500, "Use no máximo 500 caracteres no foco.").optional(),
  examStyle: z.enum(["enem", "vestibular", "school"]).default("school"),
  allowOpen: z.boolean().default(true),
  title: z.string().trim().max(160).optional(),
  folderId: z.uuid().nullable().optional(),
  subjectId: z.uuid().nullable().optional(),
});

export const chatRequestSchema = z.object({
  conversationId: z.uuid().optional(),
  message: z.string().trim().max(8000, "Mensagem longa demais (máximo de 8.000 caracteres).").default(""),
  imageFileIds: z.array(z.uuid()).max(4, "Anexe no máximo 4 imagens por mensagem.").default([]),
  sourceFileIds: z.array(z.uuid()).max(20).default([]),
  /** Gera de novo a resposta para a última pergunta (após erro, cancelamento ou a pedido). */
  regenerate: z.boolean().default(false),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
