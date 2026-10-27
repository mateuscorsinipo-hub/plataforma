/** Normalização de texto extraído: quebras, hifenização de fim de linha e caracteres de controle. */
export function normalizeText(text: string): string {
  return text
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/­/g, "")
    .replace(/([A-Za-zÀ-ÖØ-öø-ÿ])-\n(?=[a-zà-öø-ÿ])/g, "$1")
    .replace(/[ \t  -​]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function countWords(text: string): number {
  const matches = text.match(/[\p{L}\p{N}]+/gu);
  return matches ? matches.length : 0;
}
