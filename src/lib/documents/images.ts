import "server-only";

import sharp from "sharp";

import { processingLimits } from "@/lib/config/uploads";
import { DocumentError } from "@/lib/documents/errors";

/**
 * Normaliza fotos: corrige a rotação, reduz para no máximo 2000 px, converte para JPEG
 * e remove metadados (EXIF com localização GPS, modelo do celular etc.).
 */
export async function normalizeImage(input: Uint8Array): Promise<{ buffer: Buffer; width: number; height: number }> {
  try {
    const image = sharp(input, { limitInputPixels: processingLimits.maxImagePixels, failOn: "error" });
    const { data, info } = await image
      .rotate()
      .resize({
        width: processingLimits.imageMaxDimension,
        height: processingLimits.imageMaxDimension,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, width: info.width, height: info.height };
  } catch {
    throw new DocumentError("corrupted");
  }
}
