"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentProfile, getSessionUser } from "@/lib/auth/session";
import { getUserTimezone } from "@/lib/billing/entitlements";
import { XP_RULES } from "@/lib/domain/gamification";
import { logger } from "@/lib/logger";
import { achievementTitles, recordProgress } from "@/lib/progress/record";
import { checkRateLimit, rateLimits } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { makeSlug, materialSchema, publishBlockers, type MaterialInput } from "@/lib/validation/materials";

type Status = "draft" | "pending_review" | "published" | "rejected" | "removed";
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Publicar e editar exigem conta ativa (a mesma regra das páginas do app). */
async function activeAuthor() {
  const user = await getSessionUser();
  if (!user) return { error: "Sua sessão expirou. Entre de novo." } as const;
  const profile = await getCurrentProfile();
  if (!profile || profile.account_status !== "active") return { error: "Sua conta não pode publicar agora." } as const;
  return { user } as const;
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export async function saveMaterial(id: string | null, input: MaterialInput): Promise<Result<{ id: string; slug: string; status: Status }>> {
  const auth = await activeAuthor();
  if ("error" in auth) return { ok: false, error: auth.error! };
  const parsed = materialSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error.issues) };
  const data = parsed.data;
  const supabase = await createSupabaseServerClient();

  if (data.fileId) {
    // O arquivo precisa ser do autor e já ter sido validado (tipo real, metadados removidos).
    const { data: file } = await supabase.from("uploaded_files").select("id").eq("id", data.fileId).eq("status", "ready").maybeSingle();
    if (!file) return { ok: false, error: "O arquivo anexado não está disponível.", fieldErrors: { fileId: "Escolha outro arquivo." } };
  }

  const values = {
    title: data.title,
    description: data.description,
    subject_id: data.subjectId,
    school_stage: data.schoolStage,
    grade_year: data.gradeYear,
    topic: data.topic,
    tags: data.tags,
    material_type: data.materialType,
    content: data.content,
    file_id: data.fileId,
    visibility: data.visibility,
  };

  if (id) {
    const materialId = uuidSchema.safeParse(id);
    if (!materialId.success) return { ok: false, error: "Material inválido." };
    const { data: current } = await supabase
      .from("study_materials")
      .select("status, copyright_declared_at")
      .eq("id", materialId.data)
      .eq("author_id", auth.user.id)
      .maybeSingle();
    if (!current) return { ok: false, error: "Material não encontrado." };
    if (current.status === "removed") return { ok: false, error: "Materiais removidos pela moderação não podem ser editados." };
    const { data: updated, error } = await supabase
      .from("study_materials")
      .update({
        ...values,
        copyright_declared_at: data.copyright ? (current.copyright_declared_at ?? new Date().toISOString()) : null,
      })
      .eq("id", materialId.data)
      .eq("author_id", auth.user.id)
      .select("id, slug, status")
      .single();
    if (error || !updated) {
      logger.warn("materials.update_failed", { code: error?.code ?? "unknown" });
      return { ok: false, error: error?.code === "23503" ? "Escolha uma matéria válida." : "Não foi possível salvar o material." };
    }
    refresh();
    return { ok: true, id: updated.id, slug: updated.slug, status: updated.status };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: created, error } = await supabase
      .from("study_materials")
      .insert({
        ...values,
        author_id: auth.user.id,
        slug: makeSlug(data.title),
        copyright_declared_at: data.copyright ? new Date().toISOString() : null,
      })
      .select("id, slug, status")
      .single();
    if (created) return { ok: true, id: created.id, slug: created.slug, status: created.status };
    // 23505: o sufixo aleatório coincidiu com outro material; tenta outro.
    if (error?.code !== "23505") {
      logger.warn("materials.insert_failed", { code: error?.code ?? "unknown" });
      return { ok: false, error: error?.code === "23503" ? "Escolha uma matéria válida." : "Não foi possível criar o material." };
    }
  }
  return { ok: false, error: "Não foi possível criar o material. Tente de novo." };
}

/** Envia para publicação. As regras (idade, autoria, conteúdo mínimo) são conferidas de novo no banco. */
export async function submitMaterial(id: string): Promise<Result<{ status: Status; achievements: string[] }>> {
  const auth = await activeAuthor();
  if ("error" in auth) return { ok: false, error: auth.error! };
  const materialId = uuidSchema.safeParse(id);
  if (!materialId.success) return { ok: false, error: "Material inválido." };
  const supabase = await createSupabaseServerClient();
  const { data: material } = await supabase
    .from("study_materials")
    .select("visibility, copyright_declared_at, content, file_id")
    .eq("id", materialId.data)
    .eq("author_id", auth.user.id)
    .maybeSingle();
  if (!material) return { ok: false, error: "Material não encontrado." };
  const blockers = publishBlockers({
    visibility: material.visibility,
    copyright: Boolean(material.copyright_declared_at),
    content: material.content,
    fileId: material.file_id,
  });
  if (blockers.length) return { ok: false, error: blockers[0]! };
  if (!(await checkRateLimit(`publish:${auth.user.id}`, rateLimits.publish))) {
    return { ok: false, error: "Muitos envios em pouco tempo. Tente de novo mais tarde." };
  }

  const { data: status, error } = await supabase.rpc("submit_material", { p_material_id: materialId.data });
  if (error || !status) {
    // P0001/P0002 trazem mensagens pensadas para o estudante (idade, autoria, conteúdo).
    const friendly = error?.code === "P0001" || error?.code === "P0002";
    if (!friendly) logger.warn("materials.submit_failed", { code: error?.code ?? "unknown" });
    return { ok: false, error: friendly ? error!.message : "Não foi possível enviar o material." };
  }

  let achievements: string[] = [];
  if (status === "published") {
    const progress = await recordProgress({
      userId: auth.user.id,
      timezone: await getUserTimezone(auth.user.id),
      xp: {
        amount: XP_RULES.materialPublished.amount,
        dailyCap: XP_RULES.materialPublished.dailyCap,
        sourceType: "material_published",
        sourceId: materialId.data,
        reason: "Material publicado na biblioteca",
      },
    });
    achievements = await achievementTitles(progress.unlocked);
  }
  refresh();
  return { ok: true, status, achievements };
}

export async function withdrawMaterial(id: string): Promise<Result> {
  const auth = await activeAuthor();
  if ("error" in auth) return { ok: false, error: auth.error! };
  const materialId = uuidSchema.safeParse(id);
  if (!materialId.success) return { ok: false, error: "Material inválido." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("withdraw_material", { p_material_id: materialId.data });
  if (error) return { ok: false, error: error.code === "P0001" ? error.message : "Não foi possível despublicar." };
  refresh();
  return { ok: true };
}

export async function deleteMaterial(id: string): Promise<Result> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sua sessão expirou. Entre de novo." };
  const materialId = uuidSchema.safeParse(id);
  if (!materialId.success) return { ok: false, error: "Material inválido." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("study_materials").delete().eq("id", materialId.data).eq("author_id", user.id).select("id");
  if (error || !data?.length) return { ok: false, error: "Não foi possível excluir o material." };
  redirect("/app/materiais?publicacao-excluida=1");
}
