import "server-only";

import { createHash } from "node:crypto";

import { annotateUsage, consumeFeature, refundUsage } from "@/lib/billing/entitlements";
import type { PlanDefinition } from "@/lib/config/plans";
import { acceptedMimeTypes, processingLimits, type AcceptedMimeType } from "@/lib/config/uploads";
import { chunkPages, type ExtractedPage } from "@/lib/documents/chunk";
import { sniffFile, kindMatches } from "@/lib/documents/detect";
import { DocumentError, documentErrorMessages } from "@/lib/documents/errors";
import { extractDocx, extractPdf, extractPlainText, extractPptx } from "@/lib/documents/extract";
import { normalizeImage } from "@/lib/documents/images";
import { ocrImage, ocrPdf } from "@/lib/documents/ocr";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type FileRow = Database["public"]["Tables"]["uploaded_files"]["Row"];

export type ProcessResult =
  | { ok: true; file: FileRow }
  | { ok: false; code: string; message: string; status: number };

const CHUNK_BATCH = 200;
const STALE_PROCESSING_MS = 10 * 60 * 1000;

/** Falhas que podem dar certo numa nova tentativa (rede, Storage, serviço de IA). */
const TRANSIENT_FAILURES = new Set(["storage_error", "ocr_failed"]);

async function markFailed(fileId: string, message: string) {
  const admin = createSupabaseAdminClient();
  await admin
    .from("uploaded_files")
    .update({ status: "failed", error_message: message.slice(0, 500), processed_at: new Date().toISOString() })
    .eq("id", fileId);
}

async function download(path: string): Promise<Uint8Array> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from("uploads").download(path);
  if (error || !data) throw new DocumentError("storage_error");
  return new Uint8Array(await data.arrayBuffer());
}

/**
 * Processa um arquivo já enviado ao Storage: confere tamanho e tipo real, extrai o
 * texto (com leitura por IA para fotos e PDFs digitalizados), divide em trechos e
 * marca como pronto. Fotos são regravadas sem metadados.
 */
export async function processUploadedFile(params: {
  fileId: string;
  userId: string;
  plan: PlanDefinition;
  timezone: string;
  signal?: AbortSignal;
}): Promise<ProcessResult> {
  const admin = createSupabaseAdminClient();
  const { data: file } = await admin
    .from("uploaded_files")
    .select("*")
    .eq("id", params.fileId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (!file) return { ok: false, code: "not_found", message: "Arquivo não encontrado.", status: 404 };
  if (file.status === "ready") return { ok: true, file };
  // Processamento parado há mais que o tempo máximo da função foi interrompido: pode recomeçar.
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
  if (file.status === "processing" && file.updated_at > staleBefore) {
    return { ok: false, code: "busy", message: "Este arquivo já está sendo processado.", status: 409 };
  }

  // Trava otimista: só um processamento por vez para o mesmo arquivo.
  const { data: locked } = await admin
    .from("uploaded_files")
    .update({ status: "processing", error_message: null })
    .eq("id", file.id)
    .or(`status.in.(pending_upload,failed),and(status.eq.processing,updated_at.lt.${staleBefore})`)
    .select("id")
    .maybeSingle();
  if (!locked) return { ok: false, code: "busy", message: "Este arquivo já está sendo processado.", status: 409 };

  const isChatImage = file.purpose === "chat";
  // Texto puro não usa IA nem conversão pesada: não entra na cota de arquivos processados.
  const countsTowardQuota = !isChatImage && acceptedMimeTypes[file.mime_type as AcceptedMimeType]?.kind !== "text";
  let usageRecord: number | null = null;

  try {
    if (countsTowardQuota) {
      const consumption = await consumeFeature({
        userId: params.userId,
        plan: params.plan,
        feature: "file_processing",
        timezone: params.timezone,
        metadata: { file_id: file.id },
      });
      if (!consumption.ok) {
        await admin.from("uploaded_files").update({ status: "pending_upload" }).eq("id", file.id);
        return {
          ok: false,
          code: "limit_reached",
          message: `Você atingiu o limite de ${consumption.limit} arquivos processados ${consumption.window === "day" ? "hoje" : "neste mês"}.`,
          status: 429,
        };
      }
      usageRecord = consumption.recordId;
    }

    const bytes = await download(file.storage_path);
    if (bytes.byteLength > params.plan.maxUploadBytes) throw new DocumentError("too_large");
    if (bytes.byteLength === 0) throw new DocumentError("empty");

    const declared = acceptedMimeTypes[file.mime_type as AcceptedMimeType];
    if (!declared) throw new DocumentError("unsupported_type");
    const sniffed = await sniffFile(bytes);
    // Markdown e texto puro têm o mesmo formato real; o resto precisa bater exatamente.
    if (!kindMatches(declared.kind, sniffed.kind)) throw new DocumentError("mismatched_type");
    if (isChatImage && sniffed.kind !== "image") throw new DocumentError("unsupported_type");

    let pages: ExtractedPage[] = [];
    let pageCount: number | null = null;
    let stored = bytes;
    let mimeType = file.mime_type;
    let ocrTokens: { input: number; output: number; model: string } | null = null;

    if (sniffed.kind === "image") {
      const normalized = await normalizeImage(bytes);
      stored = new Uint8Array(normalized.buffer);
      mimeType = "image/jpeg";
      const { error: uploadError } = await admin.storage
        .from("uploads")
        .upload(file.storage_path, normalized.buffer, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw new DocumentError("storage_error");
      if (!isChatImage) {
        const ocr = await ocrImage(normalized.buffer, params.signal);
        pages = ocr.pages;
        ocrTokens = { input: ocr.usage.inputTokens, output: ocr.usage.outputTokens, model: ocr.model };
      }
      pageCount = 1;
    } else if (sniffed.kind === "pdf") {
      const pdf = await extractPdf(bytes);
      pageCount = pdf.pageCount;
      pages = pdf.pages;
      if (pdf.looksScanned) {
        if (pdf.pageCount > processingLimits.maxOcrPdfPages || bytes.byteLength > processingLimits.maxOcrPdfBytes) {
          if (!pages.length) throw new DocumentError("scanned_too_large");
        } else {
          try {
            const ocr = await ocrPdf(bytes, pdf.pageCount, params.signal);
            pages = ocr.pages;
            ocrTokens = { input: ocr.usage.inputTokens, output: ocr.usage.outputTokens, model: ocr.model };
          } catch (error) {
            // Sem leitura por IA, aproveitamos o pouco texto que o PDF tiver.
            if (!pages.length) throw error;
          }
        }
      }
    } else if (sniffed.kind === "docx") {
      pages = await extractDocx(bytes);
    } else if (sniffed.kind === "pptx") {
      const pptx = await extractPptx(sniffed.zip);
      pages = pptx.pages;
      pageCount = pptx.pageCount;
    } else {
      pages = extractPlainText(bytes);
    }

    const chunks = isChatImage ? [] : chunkPages(pages);
    const charCount = pages.reduce((sum, page) => sum + page.text.length, 0);
    if (!isChatImage && (!chunks.length || charCount < 20)) throw new DocumentError("empty");
    if (charCount > processingLimits.maxExtractedChars) throw new DocumentError("too_much_text");

    // Reprocessamento: substitui trechos anteriores.
    await admin.from("document_chunks").delete().eq("file_id", file.id);
    for (let i = 0; i < chunks.length; i += CHUNK_BATCH) {
      const batch = chunks.slice(i, i + CHUNK_BATCH).map((chunk) => ({
        file_id: file.id,
        user_id: file.user_id,
        chunk_index: chunk.index,
        page_start: chunk.pageStart,
        page_end: chunk.pageEnd,
        content: chunk.content,
        token_estimate: chunk.tokenEstimate,
      }));
      const { error } = await admin.from("document_chunks").insert(batch);
      if (error) {
        logger.error("documents.chunk_insert_failed", { code: error.code });
        throw new DocumentError("storage_error");
      }
    }

    const { data: updated, error: updateError } = await admin
      .from("uploaded_files")
      .update({
        status: "ready",
        mime_type: mimeType,
        size_bytes: stored.byteLength,
        sha256: createHash("sha256").update(stored).digest("hex"),
        page_count: pageCount,
        char_count: charCount,
        chunk_count: chunks.length,
        error_message: null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", file.id)
      .select("*")
      .single();
    if (updateError || !updated) throw new DocumentError("storage_error");

    if (usageRecord !== null && ocrTokens) {
      await annotateUsage(usageRecord, { input_tokens: ocrTokens.input, output_tokens: ocrTokens.output, model: ocrTokens.model });
    }
    logger.info("documents.processed", { kind: sniffed.kind, chunks: chunks.length, ocr: Boolean(ocrTokens) });
    return { ok: true, file: updated };
  } catch (error) {
    if (usageRecord !== null) await refundUsage(usageRecord);
    const code = error instanceof DocumentError ? error.code : "corrupted";
    const message = error instanceof DocumentError ? error.message : documentErrorMessages.corrupted;
    if (!(error instanceof DocumentError)) {
      logger.error("documents.process_exception", { name: error instanceof Error ? error.name : "unknown" });
    }
    if (TRANSIENT_FAILURES.has(code)) {
      // Falha passageira: o arquivo fica na lista com a opção de tentar de novo.
      await markFailed(file.id, message);
    } else {
      // Falha definitiva (conteúdo inválido, protegido, vazio...): nada fica guardado.
      await admin.storage.from("uploads").remove([file.storage_path]);
      await admin.from("uploaded_files").delete().eq("id", file.id);
    }
    return { ok: false, code, message, status: code === "storage_error" ? 502 : 422 };
  }
}
