"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { getCurrentProfile, getSessionUser } from "@/lib/auth/session";
import { checkRateLimit, rateLimits } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; needsLogin?: boolean };

/** Interações da comunidade exigem conta ativa (suspensas e pendentes não interagem). */
async function activeUser() {
  const user = await getSessionUser();
  if (!user) return { error: { ok: false as const, error: "Entre na sua conta para continuar.", needsLogin: true } };
  const profile = await getCurrentProfile();
  if (!profile || profile.account_status !== "active") return { error: { ok: false as const, error: "Sua conta não pode interagir com a comunidade agora." } };
  return { user };
}

export async function toggleMaterialSave(materialId: string, kind: "favorite" | "saved"): Promise<Result<{ active: boolean }>> {
  const auth = await activeUser();
  if ("error" in auth) return auth.error!;
  const id = uuidSchema.safeParse(materialId);
  if (!id.success || (kind !== "favorite" && kind !== "saved")) return { ok: false, error: "Dados inválidos." };
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("material_saves")
    .select("material_id")
    .eq("user_id", auth.user.id)
    .eq("material_id", id.data)
    .eq("kind", kind)
    .maybeSingle();
  if (existing) {
    await supabase.from("material_saves").delete().eq("user_id", auth.user.id).eq("material_id", id.data).eq("kind", kind);
    refresh();
    return { ok: true, active: false };
  }
  const { error } = await supabase.from("material_saves").insert({ user_id: auth.user.id, material_id: id.data, kind });
  if (error) return { ok: false, error: "Este material não está disponível para salvar." };
  refresh();
  return { ok: true, active: true };
}

export async function rateMaterial(materialId: string, value: number): Promise<Result> {
  const auth = await activeUser();
  if ("error" in auth) return auth.error!;
  const id = uuidSchema.safeParse(materialId);
  if (!id.success || !Number.isInteger(value) || value < 1 || value > 5) return { ok: false, error: "Avaliação inválida." };
  const supabase = await createSupabaseServerClient();
  const { data: updated } = await supabase
    .from("material_ratings")
    .update({ value })
    .eq("user_id", auth.user.id)
    .eq("material_id", id.data)
    .select("material_id");
  if (!updated?.length) {
    const { error } = await supabase.from("material_ratings").insert({ user_id: auth.user.id, material_id: id.data, value });
    if (error) return { ok: false, error: "Você não pode avaliar este material (ele é seu ou não está publicado)." };
  }
  refresh();
  return { ok: true };
}

const reportSchema = z.object({
  materialId: z.uuid(),
  reason: z.enum(["copyright", "inappropriate", "spam", "incorrect", "personal_data", "harassment", "other"]),
  details: z.string().trim().max(2000).optional().default(""),
});

export async function reportMaterial(input: { materialId: string; reason: string; details?: string }): Promise<Result> {
  const auth = await activeUser();
  if ("error" in auth) return auth.error!;
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escolha um motivo." };
  if (parsed.data.reason === "other" && parsed.data.details.length < 10) return { ok: false, error: "Descreva o problema em poucas palavras." };
  if (!(await checkRateLimit(`report:${auth.user.id}`, rateLimits.report))) return { ok: false, error: "Muitas denúncias em pouco tempo. Tente mais tarde." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("material_reports").insert({
    material_id: parsed.data.materialId,
    reporter_id: auth.user.id,
    reason: parsed.data.reason,
    details: parsed.data.details || null,
  });
  if (error?.code === "23505") return { ok: false, error: "Você já denunciou este material. A moderação vai analisar." };
  if (error) return { ok: false, error: "Não foi possível enviar a denúncia." };
  return { ok: true };
}
