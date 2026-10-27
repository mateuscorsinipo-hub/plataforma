import JSZip from "jszip";

import { processingLimits, type UploadKind } from "@/lib/config/uploads";
import { DocumentError } from "@/lib/documents/errors";

export type Sniffed =
  | { kind: "pdf"; mime: "application/pdf" }
  | { kind: "docx"; mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; zip: JSZip }
  | { kind: "pptx"; mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation"; zip: JSZip }
  | { kind: "image"; mime: "image/png" | "image/jpeg" | "image/webp" }
  | { kind: "text"; mime: "text/plain" };

function startsWith(buffer: Uint8Array, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

/** Tamanho descompactado declarado de cada entrada (JSZip guarda em `_data`). */
function uncompressedSize(entry: JSZip.JSZipObject): number {
  const data = (entry as unknown as { _data?: { uncompressedSize?: number } })._data;
  return typeof data?.uncompressedSize === "number" ? data.uncompressedSize : 0;
}

export async function openZipSafely(buffer: Uint8Array): Promise<JSZip> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer, { checkCRC32: false });
  } catch {
    throw new DocumentError("corrupted");
  }
  let total = 0;
  let entries = 0;
  zip.forEach((_path, entry) => {
    entries += 1;
    total += uncompressedSize(entry);
  });
  if (entries > 5000 || total > processingLimits.maxZipUncompressedBytes) throw new DocumentError("zip_bomb");
  return zip;
}

function isLikelyText(buffer: Uint8Array): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 64 * 1024));
  if (sample.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(sample.length === buffer.length ? sample : trimPartialUtf8(sample));
    return true;
  } catch {
    return false;
  }
}

/** Evita falso negativo quando a amostra corta um caractere multibyte no fim. */
function trimPartialUtf8(sample: Uint8Array): Uint8Array {
  const end = sample.length;
  for (let i = 1; i <= 3 && end - i >= 0; i++) {
    const byte = sample[end - i]!;
    if ((byte & 0xc0) === 0xc0) return sample.subarray(0, end - i);
    if ((byte & 0x80) === 0) break;
  }
  return sample;
}

/** Identifica o tipo real pelos bytes, sem confiar na extensão nem no tipo enviado pelo navegador. */
export async function sniffFile(buffer: Uint8Array): Promise<Sniffed> {
  const head = buffer.subarray(0, 1024);
  if (Buffer.from(head).includes("%PDF-")) return { kind: "pdf", mime: "application/pdf" };
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { kind: "image", mime: "image/png" };
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return { kind: "image", mime: "image/jpeg" };
  if (startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { kind: "image", mime: "image/webp" };
  }
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    const zip = await openZipSafely(buffer);
    if (!zip.file("[Content_Types].xml")) throw new DocumentError("unsupported_type");
    if (zip.file("word/document.xml")) {
      return { kind: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", zip };
    }
    if (zip.file("ppt/presentation.xml")) {
      return { kind: "pptx", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", zip };
    }
    throw new DocumentError("unsupported_type");
  }
  if (isLikelyText(buffer)) return { kind: "text", mime: "text/plain" };
  throw new DocumentError("unsupported_type");
}

export function kindMatches(declared: UploadKind, sniffed: Sniffed["kind"]): boolean {
  return declared === sniffed;
}
