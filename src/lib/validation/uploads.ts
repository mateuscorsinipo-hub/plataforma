import { z } from "zod";

/** Remove separadores de caminho e caracteres de controle do nome exibido. */
export function sanitizeFileName(name: string): string {
  const clean = name
    .replace(/[\\/]/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (clean || "arquivo").slice(0, 200);
}

export const createUploadSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do arquivo.").max(255),
  mimeType: z.string().max(120).optional().default(""),
  size: z.number().int().positive("Arquivo vazio."),
  purpose: z.enum(["study", "chat"]).default("study"),
  folderId: z.uuid().nullable().optional(),
});
