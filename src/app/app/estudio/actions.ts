"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";

type Result = { ok: true } | { ok: false; error: string };

/** Exclui o arquivo, seus trechos (cascata) e o objeto no Storage. Materiais já gerados continuam. */
export async function deleteStudyFile(fileId: string): Promise<Result> {
  await requireUser("/app/estudio");
  const id = uuidSchema.safeParse(fileId);
  if (!id.success) return { ok: false, error: "Arquivo inválido." };
  const supabase = await createSupabaseServerClient();
  const { data: file, error } = await supabase.from("uploaded_files").delete().eq("id", id.data).select("storage_path").maybeSingle();
  if (error || !file) return { ok: false, error: "Não foi possível excluir o arquivo." };
  const { error: storageError } = await supabase.storage.from("uploads").remove([file.storage_path]);
  if (storageError) logger.warn("studio.file_storage_remove_failed", { name: storageError.name });
  refresh();
  return { ok: true };
}

const titleSchema = z.string().trim().min(1, "Dê um título.").max(160, "Use no máximo 160 caracteres.");

export async function renameGeneration(id: string, title: string): Promise<Result> {
  await requireUser("/app/estudio");
  const parsedId = uuidSchema.safeParse(id);
  const parsedTitle = titleSchema.safeParse(title);
  if (!parsedId.success) return { ok: false, error: "Material inválido." };
  if (!parsedTitle.success) return { ok: false, error: parsedTitle.error.issues[0]?.message ?? "Título inválido." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_generations")
    .update({ title: parsedTitle.data })
    .eq("id", parsedId.data)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível renomear." };
  refresh();
  return { ok: true };
}

const markdownSchema = z.string().max(200_000, "O texto ficou longo demais (máximo de 200 mil caracteres).");

/** Salva a versão editada pelo estudante (o conteúdo original gerado fica preservado em `content`). */
export async function saveGenerationMarkdown(id: string, markdown: string): Promise<Result> {
  await requireUser("/app/estudio");
  const parsedId = uuidSchema.safeParse(id);
  const parsedText = markdownSchema.safeParse(markdown);
  if (!parsedId.success) return { ok: false, error: "Material inválido." };
  if (!parsedText.success) return { ok: false, error: parsedText.error.issues[0]?.message ?? "Texto inválido." };
  if (!parsedText.data.trim()) return { ok: false, error: "O material não pode ficar vazio." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_generations")
    .update({ content_markdown: parsedText.data })
    .eq("id", parsedId.data)
    .eq("status", "completed")
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível salvar." };
  refresh();
  return { ok: true };
}

export async function deleteGeneration(id: string): Promise<Result> {
  await requireUser("/app/estudio");
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "Material inválido." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("ai_generations").delete().eq("id", parsedId.data).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível excluir." };
  redirect("/app/estudio?material-excluido=1");
}
