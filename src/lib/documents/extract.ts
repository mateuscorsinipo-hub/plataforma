import "server-only";

import type JSZip from "jszip";
import mammoth from "mammoth";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";

import { processingLimits } from "@/lib/config/uploads";
import type { ExtractedPage } from "@/lib/documents/chunk";
import { DocumentError } from "@/lib/documents/errors";
import { normalizeText } from "@/lib/documents/text";

export type PdfExtraction = { pages: ExtractedPage[]; pageCount: number; looksScanned: boolean };

export async function extractPdf(buffer: Uint8Array): Promise<PdfExtraction> {
  let pdf;
  try {
    // Só extraímos texto: sem carregar fontes e sem avisos de renderização no log.
    pdf = await getDocumentProxy(new Uint8Array(buffer), { useSystemFonts: false, disableFontFace: true, verbosity: 0 });
  } catch (error) {
    if (error instanceof Error && /password/i.test(`${error.name} ${error.message}`)) {
      throw new DocumentError("password_protected");
    }
    throw new DocumentError("corrupted");
  }
  try {
    if (pdf.numPages > processingLimits.maxPdfPages) throw new DocumentError("too_many_pages");
    const { totalPages, text } = await extractPdfText(pdf, { mergePages: false });
    const pages = text
      .map((pageText, index) => ({ page: index + 1, text: normalizeText(pageText) }))
      .filter((page) => page.text.length > 0);
    const chars = pages.reduce((sum, page) => sum + page.text.length, 0);
    // Menos de ~80 caracteres por página costuma indicar páginas digitalizadas (só imagem).
    const looksScanned = chars < 80 * Math.max(1, totalPages);
    return { pages, pageCount: totalPages, looksScanned };
  } catch (error) {
    if (error instanceof DocumentError) throw error;
    throw new DocumentError("corrupted");
  } finally {
    await pdf.cleanup().catch(() => undefined);
  }
}

export async function extractDocx(buffer: Uint8Array): Promise<ExtractedPage[]> {
  try {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    const text = normalizeText(result.value);
    return text ? [{ page: null, text }] : [];
  } catch {
    throw new DocumentError("corrupted");
  }
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/g, "&");
}

/** Texto de um XML do PowerPoint: cada parágrafo <a:p> vira uma linha, com os trechos <a:t>. */
function slideXmlToText(xml: string): string {
  const paragraphs = xml.split(/<\/a:p>/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const runs = [...paragraph.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXmlEntities(m[1] ?? ""));
    const line = runs.join("").trim();
    if (line) lines.push(line);
  }
  return lines.join("\n");
}

export async function extractPptx(zip: JSZip): Promise<{ pages: ExtractedPage[]; pageCount: number }> {
  const slideFiles = Object.keys(zip.files)
    .map((path) => ({ path, match: path.match(/^ppt\/slides\/slide(\d+)\.xml$/) }))
    .filter((entry): entry is { path: string; match: RegExpMatchArray } => Boolean(entry.match))
    .map((entry) => ({ path: entry.path, number: Number(entry.match[1]) }))
    .sort((a, b) => a.number - b.number);
  if (slideFiles.length > processingLimits.maxSlides) throw new DocumentError("too_many_pages");

  const pages: ExtractedPage[] = [];
  for (const [position, slide] of slideFiles.entries()) {
    const xml = await zip.file(slide.path)?.async("string");
    const body = xml ? slideXmlToText(xml) : "";
    const notesXml = await zip.file(`ppt/notesSlides/notesSlide${slide.number}.xml`)?.async("string");
    const notes = notesXml ? slideXmlToText(notesXml).replace(/^\d+$/gm, "").trim() : "";
    const text = normalizeText([body, notes ? `Notas do apresentador:\n${notes}` : ""].filter(Boolean).join("\n\n"));
    if (text) pages.push({ page: position + 1, text });
  }
  return { pages, pageCount: slideFiles.length };
}

export function extractPlainText(buffer: Uint8Array): ExtractedPage[] {
  const text = normalizeText(new TextDecoder("utf-8").decode(buffer));
  return text ? [{ page: null, text }] : [];
}
