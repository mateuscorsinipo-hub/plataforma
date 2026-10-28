"use server";

import { randomUUID } from "node:crypto";

import { getCurrentProfile, getSessionUser } from "@/lib/auth/session";
import { getPlanForUser, getUserTimezone } from "@/lib/billing/entitlements";
import { acceptedMimeTypes, type AcceptedMimeType } from "@/lib/config/uploads";
import { getVisibleMaterial } from "@/lib/data/library";
import { processUploadedFile } from "@/lib/documents/pipeline";
import { publicEnv } from "@/lib/env/public";
import { isServiceRoleConfigured } from "@/lib/env/server";
import { logger } from "@/lib/logger";
import { checkRateLimit, rateLimits } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeFileName } from "@/lib/validation/uploads";

type Result = { ok: true; fileIds: string[]; warning: string | null } | { ok: false; error: string; needsLogin?: boolean };

const MIN_TEXT = 40;

/**
 * "Estudar com IA": cria uma cópia pessoal do material (texto e anexo) entre os
 * arquivos de estudo, passando pelo mesmo processamento de qualquer envio. Assim o
 * Estúdio e o tutor usam o conteúdo como fonte, sem acesso aos arquivos do autor.
 */
export async function studyMaterialWithAI(slug: string): Promise<Result> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Entre na sua conta para continuar.", needsLogin: true };
  const profile = await getCurrentProfile();
  if (!profile || profile.account_status !== "active" || !profile.onboarding_completed_at) {
    return { ok: false, error: "Termine de configurar sua conta para usar o Estúdio." };
  }
  if (!isServiceRoleConfigured()) return { ok: false, error: "O envio de arquivos não está configurado nesta instalação." };
  if (!(await checkRateLimit(`upload:${user.id}`, rateLimits.upload))) {
    return { ok: false, error: "Muitos arquivos em pouco tempo. Aguarde alguns minutos." };
  }

  // Visibilidade conferida com a sessão de quem pede (RLS): publicado ou do próprio autor.
  const material = await getVisibleMaterial(slug);
  if (!material) return { ok: false, error: "Material não encontrado." };
  const ownMaterial = material.author_id === user.id;
  if (!ownMaterial && (material.status !== "published" || material.visibility === "private")) {
    return { ok: false, error: "Este material não está disponível." };
  }

  const admin = createSupabaseAdminClient();
  const supabase = await createSupabaseServerClient();
  const [plan, timezone] = await Promise.all([getPlanForUser(user.id), getUserTimezone(user.id)]);
  const baseName = sanitizeFileName(material.title).slice(0, 150);
  const fileIds: string[] = [];
  let warning: string | null = null;

  /** Reaproveita a cópia feita antes (mesmo nome e pronta) em vez de duplicar. */
  async function existing(name: string): Promise<string | null> {
    const { data } = await supabase
      .from("uploaded_files")
      .select("id")
      .eq("original_name", name)
      .eq("purpose", "study")
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.id ?? null;
  }

  /** Falha no processamento (ex.: cota): a cópia não fica pendurada como envio pendente. */
  async function discard(fileId: string, storagePath: string) {
    await admin.from("uploaded_files").delete().eq("id", fileId).eq("status", "pending_upload");
    await admin.storage.from("uploads").remove([storagePath]);
  }

  async function register(name: string, mimeType: string, size: number, ext: string) {
    const storagePath = `${user!.id}/${randomUUID()}.${ext}`;
    const { data, error } = await admin
      .from("uploaded_files")
      .insert({ user_id: user!.id, storage_path: storagePath, original_name: name, mime_type: mimeType, size_bytes: size, purpose: "study", status: "pending_upload" })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.code ?? "insert_failed");
    return { id: data.id, storagePath };
  }

  const text = material.content.trim();
  // Sem anexo, o texto (mesmo curto) é a única fonte; com anexo, só vale a pena se tiver conteúdo.
  if (text.length >= MIN_TEXT || !material.file_id) {
    const name = `${baseName} (biblioteca).md`;
    const reused = await existing(name);
    if (reused) {
      fileIds.push(reused);
    } else {
      const source = `${publicEnv.siteUrl}/biblioteca/${material.slug}`;
      const markdown = [`# ${material.title}`, material.description.trim(), text, `---\nMaterial da biblioteca do Grifo: ${source}`]
        .filter(Boolean)
        .join("\n\n");
      const bytes = Buffer.from(markdown, "utf8");
      try {
        const file = await register(name, "text/markdown", bytes.byteLength, "md");
        const { error } = await admin.storage.from("uploads").upload(file.storagePath, bytes, { contentType: "text/markdown", upsert: false });
        if (error) {
          await admin.from("uploaded_files").delete().eq("id", file.id);
          return { ok: false, error: "Não foi possível preparar o material. Tente de novo." };
        }
        const processed = await processUploadedFile({ fileId: file.id, userId: user.id, plan, timezone });
        if (!processed.ok) {
          await discard(file.id, file.storagePath);
          return { ok: false, error: processed.message };
        }
        fileIds.push(file.id);
      } catch (error) {
        logger.error("library.study_copy_failed", { name: error instanceof Error ? error.message : "unknown" });
        return { ok: false, error: "Não foi possível preparar o material. Tente de novo." };
      }
    }
  }

  if (material.file_id) {
    const { data: source } = await admin
      .from("uploaded_files")
      .select("storage_path, original_name, mime_type, size_bytes, status")
      .eq("id", material.file_id)
      .eq("user_id", material.author_id)
      .maybeSingle();
    const definition = source ? acceptedMimeTypes[source.mime_type as AcceptedMimeType] : undefined;
    if (source?.status === "ready" && definition) {
      const name = sanitizeFileName(`${source.original_name.replace(/\.[^.]+$/, "")} (biblioteca).${definition.ext}`);
      const reused = ownMaterial ? material.file_id : await existing(name);
      if (reused) {
        fileIds.push(reused);
      } else if (source.size_bytes > plan.maxUploadBytes) {
        warning = "O arquivo anexado passa do limite do seu plano; usamos só o texto do material.";
      } else {
        try {
          const file = await register(name, source.mime_type, source.size_bytes, definition.ext);
          const { error } = await admin.storage.from("uploads").copy(source.storage_path, file.storagePath);
          if (error) {
            await admin.from("uploaded_files").delete().eq("id", file.id);
            warning = "Não foi possível copiar o arquivo anexado; usamos só o texto do material.";
          } else {
            const processed = await processUploadedFile({ fileId: file.id, userId: user.id, plan, timezone });
            if (processed.ok) {
              fileIds.push(file.id);
            } else {
              await discard(file.id, file.storagePath);
              warning = `O arquivo anexado não entrou: ${processed.message}`;
            }
          }
        } catch (error) {
          logger.error("library.study_attachment_failed", { name: error instanceof Error ? error.message : "unknown" });
          warning = "Não foi possível copiar o arquivo anexado.";
        }
      }
    }
  }

  if (!fileIds.length) return { ok: false, error: warning ?? "Este material não tem conteúdo suficiente para estudar com IA." };
  return { ok: true, fileIds, warning };
}
