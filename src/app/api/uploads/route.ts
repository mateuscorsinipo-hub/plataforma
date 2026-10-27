import { randomUUID } from "node:crypto";

import { aiAvailability, aiSupportsImages } from "@/lib/ai";
import { checkSameOrigin, jsonError, readJson, requireApiStudent } from "@/lib/api/guard";
import { getPlanForUser, getUsageSummary, getUserTimezone } from "@/lib/billing/entitlements";
import { acceptedMimeTypes, formatBytes, resolveMimeType } from "@/lib/config/uploads";
import { isServiceRoleConfigured } from "@/lib/env/server";
import { logger } from "@/lib/logger";
import { checkRateLimit, rateLimits } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createUploadSchema, sanitizeFileName } from "@/lib/validation/uploads";

/**
 * Registra um envio e devolve uma URL assinada de uso único: o arquivo vai do
 * navegador direto ao Storage privado, e o servidor valida o conteúdo depois.
 */
export async function POST(request: Request) {
  const blocked = checkSameOrigin(request);
  if (blocked) return blocked;
  const auth = await requireApiStudent();
  if (!auth.ok) return auth.response;
  const { user } = auth.ctx;

  if (!isServiceRoleConfigured()) {
    return jsonError(503, "O envio de arquivos não está configurado nesta instalação.");
  }
  if (!(await checkRateLimit(`upload:${user.id}`, rateLimits.upload))) {
    return jsonError(429, "Muitos envios em pouco tempo. Aguarde alguns minutos.");
  }

  let body: unknown;
  try {
    body = await readJson(request, 8 * 1024);
  } catch {
    return jsonError(400, "Requisição inválida.");
  }
  const parsed = createUploadSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const input = parsed.data;

  const mimeType = resolveMimeType(input.name, input.mimeType);
  if (!mimeType) {
    return jsonError(415, "Tipo de arquivo não suportado. Envie PDF, Word (.docx), PowerPoint (.pptx), imagem ou texto.");
  }
  const kind = acceptedMimeTypes[mimeType].kind;
  if (input.purpose === "chat" && kind !== "image") {
    return jsonError(415, "No chat, anexe imagens. Documentos entram como fontes da conversa.");
  }

  const [plan, timezone] = await Promise.all([getPlanForUser(user.id), getUserTimezone(user.id)]);
  if (input.size > plan.maxUploadBytes) {
    return jsonError(413, `O arquivo passa do limite de ${formatBytes(plan.maxUploadBytes)} do plano ${plan.name}.`);
  }

  if (kind === "image" && (!aiAvailability().available || !aiSupportsImages())) {
    return jsonError(422, "A leitura de imagens não está disponível nesta instalação.");
  }
  if (input.purpose === "study" && kind !== "text") {
    const usage = await getUsageSummary(user.id, plan, timezone);
    if (usage.file_processing.remaining <= 0) {
      return jsonError(429, `Você atingiu o limite de ${usage.file_processing.limit} arquivos processados neste período.`, {
        code: "limit_reached",
      });
    }
  }

  const supabase = await createSupabaseServerClient();
  if (input.folderId) {
    const { data: folder } = await supabase.from("folders").select("id").eq("id", input.folderId).maybeSingle();
    if (!folder) return jsonError(404, "Pasta não encontrada.");
  }

  const storagePath = `${user.id}/${randomUUID()}.${acceptedMimeTypes[mimeType].ext}`;
  const admin = createSupabaseAdminClient();
  const { data: file, error } = await admin
    .from("uploaded_files")
    .insert({
      user_id: user.id,
      folder_id: input.folderId ?? null,
      storage_path: storagePath,
      original_name: sanitizeFileName(input.name),
      mime_type: mimeType,
      size_bytes: input.size,
      purpose: input.purpose,
      status: "pending_upload",
    })
    .select("id")
    .single();
  if (error || !file) {
    logger.error("uploads.create_failed", { code: error?.code ?? "unknown" });
    return jsonError(500, "Não foi possível preparar o envio. Tente novamente.");
  }

  const { data: signed, error: signError } = await admin.storage.from("uploads").createSignedUploadUrl(storagePath);
  if (signError || !signed) {
    await admin.from("uploaded_files").delete().eq("id", file.id);
    logger.error("uploads.sign_failed", { name: signError?.name ?? "unknown" });
    return jsonError(502, "Não foi possível preparar o envio. Tente novamente.");
  }

  return Response.json(
    { fileId: file.id, path: storagePath, token: signed.token, mimeType },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
