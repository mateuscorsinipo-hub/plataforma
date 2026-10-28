import { z } from "zod";

import { gradeOptions, materialTypeLabels, schoolStageLabels, type MaterialType, type SchoolStage } from "@/lib/config/subjects";

export const visibilityLabels = {
  public: "Pública",
  unlisted: "Só com o link",
  private: "Privada",
} as const;

export const visibilityDescriptions = {
  public: "Aparece na busca da biblioteca e no seu perfil.",
  unlisted: "Não aparece na busca; só quem tiver o link consegue abrir.",
  private: "Só você vê. Não pode ser enviada para publicação.",
} as const;

export const materialStatusLabels = {
  draft: "Rascunho",
  pending_review: "Em revisão",
  published: "Publicado",
  rejected: "Precisa de ajustes",
  removed: "Removido",
} as const;

export const reportReasonLabels = {
  copyright: "Violação de direitos autorais",
  inappropriate: "Conteúdo impróprio",
  spam: "Spam ou propaganda",
  incorrect: "Conteúdo errado",
  personal_data: "Expõe dados pessoais",
  harassment: "Ofensa ou assédio",
  other: "Outro motivo",
} as const;

export const MIN_PUBLISH_CONTENT = 200;

/** Etiquetas: separadas por vírgula, minúsculas, sem repetição, até 10 com 30 caracteres. */
export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(/[,;\n]/)) {
    const tag = part.trim().replace(/^#/, "").replace(/\s+/g, " ").toLowerCase().slice(0, 30).trim();
    if (tag) seen.add(tag);
    if (seen.size >= 10) break;
  }
  return [...seen];
}

/** Parte legível da URL a partir do título (sem acentos, só letras, números e hífens). */
export function slugBase(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return base || "material";
}

/** Sufixo aleatório: URLs estáveis mesmo com títulos repetidos. */
export function makeSlug(title: string, random: () => number = Math.random): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += alphabet[Math.floor(random() * alphabet.length)];
  return `${slugBase(title)}-${suffix}`;
}

export const materialSchema = z
  .object({
    title: z.string().trim().min(5, "O título precisa de pelo menos 5 caracteres.").max(140, "Use no máximo 140 caracteres."),
    description: z.string().trim().max(1000, "Use no máximo 1000 caracteres.").default(""),
    subjectId: z.uuid({ error: "Escolha a matéria." }),
    schoolStage: z
      .string()
      .optional()
      .transform((v) => (v && v in schoolStageLabels ? (v as SchoolStage) : null)),
    gradeYear: z
      .union([z.number(), z.string()])
      .optional()
      .transform((v) => {
        const n = typeof v === "number" ? v : Number.parseInt(v ?? "", 10);
        return Number.isInteger(n) ? n : null;
      }),
    topic: z.string().trim().max(120, "Use no máximo 120 caracteres.").default(""),
    tags: z.string().max(500).default(""),
    materialType: z.enum(Object.keys(materialTypeLabels) as [MaterialType, ...MaterialType[]], { error: "Escolha o tipo." }),
    content: z.string().max(100_000, "O conteúdo passou de 100 mil caracteres.").default(""),
    fileId: z.uuid().nullable().default(null),
    visibility: z.enum(["public", "unlisted", "private"]).default("public"),
    copyright: z.boolean().default(false),
  })
  .transform((data) => {
    const grades = data.schoolStage ? gradeOptions[data.schoolStage] : [];
    return {
      ...data,
      gradeYear: data.gradeYear !== null && grades.some((g) => g.value === data.gradeYear) ? data.gradeYear : null,
      topic: data.topic || null,
      tags: parseTags(data.tags),
      content: data.content.replace(/\r\n/g, "\n").trimEnd(),
    };
  });

export type MaterialInput = z.input<typeof materialSchema>;
export type MaterialData = z.output<typeof materialSchema>;

/** Pendências que impedem o envio (as mesmas regras que o banco confere em submit_material). */
export function publishBlockers(data: Pick<MaterialData, "visibility" | "copyright" | "content" | "fileId">): string[] {
  const issues: string[] = [];
  if (data.visibility === "private") issues.push("Escolha a visibilidade pública ou só com o link.");
  if (data.content.trim().length < MIN_PUBLISH_CONTENT && !data.fileId) {
    issues.push(`Escreva pelo menos ${MIN_PUBLISH_CONTENT} caracteres de conteúdo ou anexe um arquivo.`);
  }
  if (!data.copyright) issues.push("Confirme que o material é seu ou que você tem autorização para publicá-lo.");
  return issues;
}

export const folderColors = ["blue", "green", "purple", "rose", "amber", "teal", "orange", "slate"] as const;

export const folderSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome para a pasta.").max(80, "Use no máximo 80 caracteres."),
  color: z.enum(folderColors).default("blue"),
  subjectId: z
    .string()
    .optional()
    .transform((v) => (v && z.uuid().safeParse(v).success ? v : null)),
  examDate: z
    .string()
    .optional()
    .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)),
});

export type FolderInput = z.input<typeof folderSchema>;

export const folderItemKinds = ["file", "generation", "deck", "quiz", "conversation", "material"] as const;
export type FolderItemKind = (typeof folderItemKinds)[number];
