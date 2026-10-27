"use client";

import { resolveMimeType, type UploadPurpose } from "@/lib/config/uploads";
import type { FileSummary } from "@/lib/documents/summary";
import { errorMessageOf } from "@/lib/client/ndjson";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type UploadStage = "preparing" | "uploading" | "processing";

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

const MAX_CLIENT_DIMENSION = 2400;

/**
 * Fotos grandes do celular são reduzidas no próprio aparelho antes do envio
 * (menos dados móveis e envio mais rápido). O servidor normaliza de novo.
 */
async function downscaleImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 1.5 * 1024 * 1024 || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_CLIENT_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** Envia ao Storage por URL assinada e pede ao servidor para validar e processar. */
export async function uploadAndProcess(
  original: File,
  options: { purpose: UploadPurpose; folderId?: string | null; onStage?: (stage: UploadStage) => void; signal?: AbortSignal },
): Promise<FileSummary> {
  options.onStage?.("preparing");
  const file = await downscaleImage(original);
  const mimeType = resolveMimeType(file.name, file.type);
  if (!mimeType) throw new UploadError("Tipo de arquivo não suportado. Envie PDF, Word (.docx), PowerPoint (.pptx), imagem ou texto.");

  const created = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, mimeType, size: file.size, purpose: options.purpose, folderId: options.folderId ?? null }),
    signal: options.signal,
  });
  if (!created.ok) throw new UploadError(await errorMessageOf(created));
  const { fileId, path, token } = (await created.json()) as { fileId: string; path: string; token: string };

  options.onStage?.("uploading");
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage.from("uploads").uploadToSignedUrl(path, token, file, { contentType: mimeType });
  if (error) throw new UploadError("O envio do arquivo falhou. Verifique sua conexão e tente novamente.");

  options.onStage?.("processing");
  const processed = await fetch(`/api/uploads/${fileId}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    signal: options.signal,
  });
  if (!processed.ok) throw new UploadError(await errorMessageOf(processed));
  const { file: summary } = (await processed.json()) as { file: FileSummary };
  return summary;
}

export const uploadStageLabels: Record<UploadStage, string> = {
  preparing: "Preparando…",
  uploading: "Enviando…",
  processing: "Lendo o conteúdo…",
};
