/**
 * Tipos de arquivo aceitos. Compartilhado entre cliente (atributo accept, mensagens)
 * e servidor (validação). O servidor confirma o tipo real pelos bytes do arquivo.
 */
export type UploadKind = "pdf" | "docx" | "pptx" | "image" | "text";

export type UploadPurpose = "study" | "chat";

export const acceptedMimeTypes = {
  "application/pdf": { kind: "pdf", ext: "pdf", label: "PDF" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { kind: "docx", ext: "docx", label: "Word" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { kind: "pptx", ext: "pptx", label: "PowerPoint" },
  "image/png": { kind: "image", ext: "png", label: "Imagem" },
  "image/jpeg": { kind: "image", ext: "jpg", label: "Imagem" },
  "image/webp": { kind: "image", ext: "webp", label: "Imagem" },
  "text/plain": { kind: "text", ext: "txt", label: "Texto" },
  "text/markdown": { kind: "text", ext: "md", label: "Texto" },
} as const satisfies Record<string, { kind: UploadKind; ext: string; label: string }>;

export type AcceptedMimeType = keyof typeof acceptedMimeTypes;

export const imageMimeTypes = ["image/png", "image/jpeg", "image/webp"] as const;

/** Extensões usadas quando o navegador não informa o tipo (comum com .md e .docx no Android). */
const extensionToMime: Record<string, AcceptedMimeType> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
};

export function resolveMimeType(name: string, declared: string | null | undefined): AcceptedMimeType | null {
  const normalized = (declared ?? "").toLowerCase().split(";")[0]?.trim() ?? "";
  if (normalized in acceptedMimeTypes) return normalized as AcceptedMimeType;
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return extensionToMime[ext] ?? null;
}

export const studyAccept = Object.keys(acceptedMimeTypes).join(",") + ",.md,.markdown,.docx,.pptx";
export const imageAccept = imageMimeTypes.join(",");

/** Limites técnicos (independentes do plano) para proteger o processamento. */
export const processingLimits = {
  maxPdfPages: 600,
  maxSlides: 400,
  maxExtractedChars: 2_000_000,
  maxZipUncompressedBytes: 150 * 1024 * 1024,
  /** PDFs digitalizados acima disso não passam por leitura de imagem (custo e tempo). */
  maxOcrPdfPages: 20,
  /** O PDF vai em base64 para o modelo: acima disso a requisição passa do limite do provedor. */
  maxOcrPdfBytes: 20 * 1024 * 1024,
  maxImagePixels: 40_000_000,
  imageMaxDimension: 2000,
} as const;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0).replace(".", ",")} MB`;
}
