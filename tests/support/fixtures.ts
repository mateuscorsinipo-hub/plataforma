import JSZip from "jszip";

/**
 * Arquivos de teste gerados em memória (nada binário versionado).
 * O PDF é montado à mão com offsets corretos na tabela xref.
 */
export function makePdf(pages: string[]): Uint8Array {
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  pages.forEach((text, i) => {
    const pageId = pageIds[i]!;
    const contentId = pageId + 1;
    const lines = text.split("\n");
    const ops = lines
      .map((line, index) => `BT /F1 12 Tf 72 ${720 - index * 18} Td (${line.replace(/[\\()]/g, (c) => `\\${c}`)}) Tj ET`)
      .join("\n");
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(ops, "latin1")} >>\nstream\n${ops}\nendstream`;
  });

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(body, "latin1");
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) body += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(body, "latin1"));
}

export async function makeDocx(paragraphs: string[]): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  const body = paragraphs.map((p) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(p)}</w:t></w:r></w:p>`).join("");
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
  );
  return new Uint8Array(await zip.generateAsync({ type: "nodebuffer" }));
}

export async function makePptx(slides: { lines: string[]; notes?: string }[]): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`,
  );
  zip.file("ppt/presentation.xml", `<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`);
  const ns = `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"`;
  slides.forEach((slide, i) => {
    const paragraphs = slide.lines.map((line) => `<a:p><a:r><a:t>${escapeXml(line)}</a:t></a:r></a:p>`).join("");
    zip.file(`ppt/slides/slide${i + 1}.xml`, `<?xml version="1.0"?><p:sld ${ns}>${paragraphs}</p:sld>`);
    if (slide.notes) {
      zip.file(
        `ppt/notesSlides/notesSlide${i + 1}.xml`,
        `<?xml version="1.0"?><p:notes ${ns}><a:p><a:r><a:t>${escapeXml(slide.notes)}</a:t></a:r></a:p></p:notes>`,
      );
    }
  });
  return new Uint8Array(await zip.generateAsync({ type: "nodebuffer" }));
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** PNG 1x1 válido (cabeçalho real), útil para testar a detecção de tipo. */
export const tinyPng = new Uint8Array(
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"),
);
