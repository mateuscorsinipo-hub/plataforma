import { estimateTokens } from "@/lib/ai/config";

export type ExtractedPage = { page: number | null; text: string };

export type Chunk = {
  index: number;
  pageStart: number | null;
  pageEnd: number | null;
  content: string;
  tokenEstimate: number;
};

export type ChunkOptions = { target: number; max: number; overlap: number };

// Sem sobreposição: o estúdio concatena os trechos e não pode repetir texto.
const defaults: ChunkOptions = { target: 1800, max: 2600, overlap: 0 };

/** Divide um bloco longo em frases; frases enormes são cortadas em pedaços fixos. */
function splitLong(text: string, max: number): string[] {
  const sentences = text.match(/[^.!?;:\n]+(?:[.!?;:]+|\n|$)/g) ?? [text];
  const parts: string[] = [];
  let current = "";
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (sentence.length > max) {
      if (current) parts.push(current);
      current = "";
      for (let i = 0; i < sentence.length; i += max) parts.push(sentence.slice(i, i + max));
      continue;
    }
    if (current.length + sentence.length + 1 > max) {
      parts.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/** Final do trecho anterior, começando numa fronteira de frase, para dar continuidade à busca. */
function overlapTail(text: string, size: number): string {
  if (size <= 0 || text.length <= size) return "";
  const tail = text.slice(-size);
  const boundary = tail.search(/[.!?]\s+\S/);
  return boundary >= 0 ? tail.slice(boundary + 1).trim() : "";
}

/**
 * Agrupa parágrafos em trechos de tamanho parecido, preservando o intervalo de páginas.
 * Trechos são a unidade de busca do tutor e de condensação do estúdio.
 */
export function chunkPages(pages: ExtractedPage[], options: Partial<ChunkOptions> = {}): Chunk[] {
  const { target, max, overlap } = { ...defaults, ...options };
  const units: { text: string; page: number | null }[] = [];
  for (const page of pages) {
    const paragraphs = page.text.split(/\n{2,}/);
    for (const paragraph of paragraphs) {
      const clean = paragraph.replace(/\n/g, " ").trim();
      if (!clean) continue;
      if (clean.length > max) {
        for (const piece of splitLong(clean, max)) units.push({ text: piece, page: page.page });
      } else {
        units.push({ text: clean, page: page.page });
      }
    }
  }

  const chunks: Chunk[] = [];
  let buffer: string[] = [];
  let length = 0;
  let pageStart: number | null = null;
  let pageEnd: number | null = null;

  const flush = () => {
    if (!buffer.length) return;
    const content = buffer.join("\n\n");
    chunks.push({ index: chunks.length, pageStart, pageEnd, content, tokenEstimate: Math.max(1, estimateTokens(content)) });
    const tail = overlapTail(content, overlap);
    buffer = tail ? [tail] : [];
    length = tail.length;
    pageStart = tail ? pageEnd : null;
  };

  for (const unit of units) {
    if (length + unit.text.length > target && length > 0) flush();
    if (!buffer.length || pageStart === null) pageStart = unit.page;
    buffer.push(unit.text);
    length += unit.text.length + 2;
    pageEnd = unit.page;
  }
  // Evita um último trecho que seja só a sobreposição do anterior.
  if (buffer.length && !(chunks.length && buffer.length === 1 && length <= overlap + 2)) flush();
  return chunks;
}
