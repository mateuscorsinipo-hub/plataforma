import { describe, expect, it } from "vitest";

import { resolveMimeType } from "@/lib/config/uploads";
import { chunkPages } from "@/lib/documents/chunk";
import { openZipSafely, sniffFile } from "@/lib/documents/detect";
import { DocumentError } from "@/lib/documents/errors";
import { extractDocx, extractPdf, extractPlainText, extractPptx } from "@/lib/documents/extract";
import { splitByPageMarkers } from "@/lib/documents/ocr";
import { normalizeText } from "@/lib/documents/text";
import { sanitizeFileName } from "@/lib/validation/uploads";

import { makeDocx, makePdf, makePptx, tinyPng } from "../support/fixtures";

describe("detecção do tipo real", () => {
  it("reconhece PDF, PNG, JPEG, WEBP e texto pelos bytes", async () => {
    expect((await sniffFile(makePdf(["Oi"]))).kind).toBe("pdf");
    expect((await sniffFile(tinyPng)).mime).toBe("image/png");
    expect((await sniffFile(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).mime).toBe("image/jpeg");
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect((await sniffFile(webp)).mime).toBe("image/webp");
    expect((await sniffFile(new TextEncoder().encode("Anotações de aula: ção, ã, é"))).kind).toBe("text");
  });

  it("distingue DOCX de PPTX pelo conteúdo do pacote", async () => {
    expect((await sniffFile(await makeDocx(["Texto"]))).kind).toBe("docx");
    expect((await sniffFile(await makePptx([{ lines: ["Slide"] }]))).kind).toBe("pptx");
  });

  it("rejeita binário desconhecido", async () => {
    await expect(sniffFile(new Uint8Array([0, 1, 2, 3, 0, 255, 0]))).rejects.toBeInstanceOf(DocumentError);
  });

  it("não confunde texto com acento cortado no fim da amostra com binário", async () => {
    const text = "a".repeat(64 * 1024 - 1) + "ção";
    expect((await sniffFile(new TextEncoder().encode(text))).kind).toBe("text");
  });

  it("recusa ZIP que não é documento do Office", async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file("qualquer.txt", "oi");
    const bytes = new Uint8Array(await zip.generateAsync({ type: "nodebuffer" }));
    await expect(sniffFile(bytes)).rejects.toMatchObject({ code: "unsupported_type" });
    expect(await openZipSafely(bytes)).toBeTruthy();
  });
});

describe("extração de texto", () => {
  it("lê PDF página por página", async () => {
    const result = await extractPdf(makePdf(["Fotossintese ocorre nos cloroplastos.", "Ciclo de Calvin no estroma."]));
    expect(result.pageCount).toBe(2);
    expect(result.pages.map((p) => p.page)).toEqual([1, 2]);
    expect(result.pages[0]!.text).toContain("cloroplastos");
    expect(result.pages[1]!.text).toContain("Calvin");
  });

  it("marca PDF sem texto como digitalizado", async () => {
    const result = await extractPdf(makePdf([""]));
    expect(result.looksScanned).toBe(true);
  });

  it("recusa PDF corrompido", async () => {
    await expect(extractPdf(new TextEncoder().encode("%PDF-1.4 lixo sem estrutura"))).rejects.toBeInstanceOf(DocumentError);
  });

  it("lê DOCX", async () => {
    const pages = await extractDocx(await makeDocx(["Revolução Francesa", "Queda da Bastilha em 1789."]));
    expect(pages[0]!.text).toContain("Revolução Francesa");
    expect(pages[0]!.text).toContain("1789");
  });

  it("lê PPTX na ordem dos slides, com notas e entidades XML", async () => {
    const JSZip = (await import("jszip")).default;
    const bytes = await makePptx([
      { lines: ["Leis de Newton", "Inércia & equilíbrio"] },
      { lines: ["F = m · a"], notes: "Exemplo do carrinho" },
    ]);
    const { pages, pageCount } = await extractPptx(await JSZip.loadAsync(bytes));
    expect(pageCount).toBe(2);
    expect(pages[0]!.text).toContain("Inércia & equilíbrio");
    expect(pages[1]!.text).toContain("Notas do apresentador");
    expect(pages[1]!.text).toContain("Exemplo do carrinho");
  });

  it("lê texto puro e remove BOM", () => {
    const pages = extractPlainText(new TextEncoder().encode("﻿Título\r\n\r\n\r\nCorpo"));
    expect(pages[0]!.text).toBe("Título\n\nCorpo");
  });
});

describe("normalização e fatiamento", () => {
  it("junta palavras hifenizadas no fim da linha e limpa espaços", () => {
    expect(normalizeText("foto-\nssíntese   é\t\tvital\n\n\n\nfim")).toBe("fotossíntese é vital\n\nfim");
  });

  it("agrupa parágrafos em trechos com intervalo de páginas", () => {
    const paragraph = "Frase de estudo com conteúdo relevante. ".repeat(20).trim();
    const chunks = chunkPages(
      [
        { page: 1, text: `${paragraph}\n\n${paragraph}` },
        { page: 2, text: `${paragraph}\n\n${paragraph}` },
        { page: 3, text: paragraph },
      ],
      { target: 1800, max: 2600 },
    );
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.pageStart).toBe(1);
    expect(chunks[chunks.length - 1]!.pageEnd).toBe(3);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeGreaterThan(0);
      expect(chunk.content.length).toBeLessThanOrEqual(2600 * 2);
      expect(chunk.tokenEstimate).toBeGreaterThan(0);
    }
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
  });

  it("corta parágrafos gigantes sem perder texto", () => {
    const huge = "palavra ".repeat(2000).trim();
    const chunks = chunkPages([{ page: null, text: huge }]);
    const total = chunks.reduce((sum, c) => sum + c.content.replace(/\s+/g, "").length, 0);
    expect(total).toBe(huge.replace(/\s+/g, "").length);
    expect(Math.max(...chunks.map((c) => c.content.length))).toBeLessThanOrEqual(2600 + 2);
  });

  it("separa transcrição por marcadores de página", () => {
    const pages = splitByPageMarkers("=== Página 1 ===\nTexto um\n=== Página 2 ===\nSEM_TEXTO\n=== Pagina 3 ===\nTexto três");
    expect(pages).toEqual([
      { page: 1, text: "Texto um" },
      { page: 3, text: "Texto três" },
    ]);
  });
});

describe("validação de envio", () => {
  it("resolve o tipo pela extensão quando o navegador não informa", () => {
    expect(resolveMimeType("resumo.md", "")).toBe("text/markdown");
    expect(resolveMimeType("aula.PPTX", "application/octet-stream")).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    expect(resolveMimeType("foto.jpeg", "image/jpeg")).toBe("image/jpeg");
    expect(resolveMimeType("virus.exe", "application/x-msdownload")).toBeNull();
  });

  it("limpa nomes de arquivo com caminhos e caracteres de controle", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe(".. .. etc passwd");
    expect(sanitizeFileName("aula\u0000\u0007 1.pdf")).toBe("aula 1.pdf");
    expect(sanitizeFileName("   ")).toBe("arquivo");
  });
});
