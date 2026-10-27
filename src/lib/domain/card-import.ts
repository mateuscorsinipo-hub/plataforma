/**
 * Importação de cartões colados: uma linha por cartão, frente e verso separados por
 * tabulação (formato exportado por Anki e Quizlet), ponto e vírgula ou " - ".
 */
export type ImportedCard = { front: string; back: string };

export type ImportResult = { cards: ImportedCard[]; skipped: number[] };

const SEPARATORS = ["\t", ";", " - ", " — ", " = ", ":"] as const;

function splitLine(line: string, separator?: string): [string, string] | null {
  const seps = separator ? [separator] : SEPARATORS;
  for (const sep of seps) {
    const index = line.indexOf(sep);
    if (index > 0) {
      const front = line.slice(0, index).trim();
      const back = line.slice(index + sep.length).trim();
      if (front && back) return [front, back];
    }
  }
  return null;
}

/** Detecta o separador mais comum nas linhas (evita quebrar textos que têm ":" no meio). */
export function detectSeparator(lines: string[]): string | undefined {
  let best: { sep: string; count: number } | undefined;
  for (const sep of SEPARATORS) {
    const count = lines.filter((line) => line.indexOf(sep) > 0).length;
    if (count > 0 && (!best || count > best.count)) best = { sep, count };
  }
  return best && best.count >= Math.ceil(lines.length * 0.6) ? best.sep : undefined;
}

export function parseCardImport(text: string, limit = 500): ImportResult {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const separator = detectSeparator(lines);
  const cards: ImportedCard[] = [];
  const skipped: number[] = [];
  lines.forEach((line, index) => {
    if (cards.length >= limit) {
      skipped.push(index + 1);
      return;
    }
    const parts = splitLine(line, separator) ?? (separator ? null : splitLine(line));
    if (!parts || parts[0].length > 2000 || parts[1].length > 4000) {
      skipped.push(index + 1);
      return;
    }
    cards.push({ front: parts[0], back: parts[1] });
  });
  return { cards, skipped };
}
