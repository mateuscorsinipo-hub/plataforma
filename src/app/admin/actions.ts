"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";

import { audit, notifyUser } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/auth/session";
import { safeTimezone } from "@/lib/domain/dates";
import { XP_RULES } from "@/lib/domain/gamification";
import { logger } from "@/lib/logger";
import { recordProgress } from "@/lib/progress/record";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true; message?: string } | { ok: false; error: string };

const AUTO_HIDE_NOTE = "Em revisão após denúncias da comunidade.";
const noteSchema = z.string().trim().min(10, "Explique o motivo em pelo menos 10 caracteres.").max(1000);
const uuid = z.uuid();

async function authorTimezone(userId: string): Promise<string> {
  const { data } = await createSupabaseAdminClient().from("user_preferences").select("timezone").eq("user_id", userId).maybeSingle();
  return safeTimezone(data?.timezone);
}

async function closeReports(materialId: string, status: "resolved_removed" | "resolved_kept" | "dismissed", actorId: string, note: string | null) {
  await createSupabaseAdminClient()
    .from("material_reports")
    .update({ status, resolved_by: actorId, resolved_at: new Date().toISOString(), resolution_note: note })
    .eq("material_id", materialId)
    .eq("status", "open");
}

/** Publica um material em revisão: XP e conquista para o autor, aviso e auditoria. */
async function publish(materialId: string, actorId: string, keepReports: boolean): Promise<Result> {
  const db = createSupabaseAdminClient();
  const { data: material } = await db.from("study_materials").select("id, slug, title, author_id, status").eq("id", materialId).maybeSingle();
  if (!material) return { ok: false, error: "Material não encontrado." };
  if (material.status !== "pending_review") return { ok: false, error: "Este material não está aguardando revisão." };
  if (material.author_id === actorId) return { ok: false, error: "Peça para outra pessoa da moderação revisar o seu material." };
  const { error } = await db
    .from("study_materials")
    .update({ status: "published", moderation_note: null, published_at: new Date().toISOString() })
    .eq("id", materialId)
    .eq("status", "pending_review");
  if (error) return { ok: false, error: "Não foi possível publicar." };
  if (keepReports) await closeReports(materialId, "resolved_kept", actorId, null);
  await recordProgress({
    userId: material.author_id,
    timezone: await authorTimezone(material.author_id),
    xp: {
      amount: XP_RULES.materialPublished.amount,
      dailyCap: XP_RULES.materialPublished.dailyCap,
      sourceType: "material_published",
      sourceId: material.id,
      reason: "Material publicado na biblioteca",
    },
  });
  await notifyUser(material.author_id, {
    type: "material_published",
    title: "Seu material foi publicado",
    body: `“${material.title}” já aparece na biblioteca.`,
    link: `/biblioteca/${material.slug}`,
  });
  await audit({ actorId, action: "material.approve", targetType: "material", targetId: materialId, details: { title: material.title } });
  return { ok: true, message: "Material publicado." };
}

async function takeDown(materialId: string, actorId: string, decision: "changes" | "remove", note: string): Promise<Result> {
  const db = createSupabaseAdminClient();
  const { data: material } = await db.from("study_materials").select("id, slug, title, author_id, status").eq("id", materialId).maybeSingle();
  if (!material) return { ok: false, error: "Material não encontrado." };
  if (material.status === "removed") return { ok: false, error: "Este material já foi removido." };
  const status = decision === "remove" ? "removed" : "rejected";
  const { error } = await db.from("study_materials").update({ status, moderation_note: note }).eq("id", materialId);
  if (error) return { ok: false, error: "Não foi possível atualizar o material." };
  if (decision === "remove") await closeReports(materialId, "resolved_removed", actorId, note);
  await notifyUser(material.author_id, {
    type: decision === "remove" ? "material_removed" : "material_rejected",
    title: decision === "remove" ? "Seu material foi removido" : "Seu material precisa de ajustes",
    body: `“${material.title}”: ${note}`,
    link: decision === "remove" ? `/app/biblioteca/${material.slug}` : `/app/materiais/${material.id}/editar`,
  });
  await audit({
    actorId,
    action: decision === "remove" ? "material.remove" : "material.request_changes",
    targetType: "material",
    targetId: materialId,
    details: { title: material.title, note, previous_status: material.status },
  });
  return { ok: true, message: decision === "remove" ? "Material removido." : "Pedido de ajustes enviado ao autor." };
}

export async function moderateMaterial(materialId: string, decision: "approve" | "changes" | "remove", note?: string): Promise<Result> {
  const { user } = await requireStaff();
  const id = uuid.safeParse(materialId);
  if (!id.success) return { ok: false, error: "Material inválido." };
  let result: Result;
  if (decision === "approve") {
    result = await publish(id.data, user.id, true);
  } else {
    const parsed = noteSchema.safeParse(note ?? "");
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
    result = await takeDown(id.data, user.id, decision, parsed.data);
  }
  if (result.ok) refresh();
  return result;
}

/** Decide as denúncias abertas de um material. */
export async function resolveMaterialReports(materialId: string, outcome: "keep" | "remove" | "dismiss", note?: string): Promise<Result> {
  const { user } = await requireStaff();
  const id = uuid.safeParse(materialId);
  if (!id.success) return { ok: false, error: "Material inválido." };
  const db = createSupabaseAdminClient();

  if (outcome === "remove") {
    const parsed = noteSchema.safeParse(note ?? "");
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
    const result = await takeDown(id.data, user.id, "remove", parsed.data);
    if (result.ok) refresh();
    return result;
  }

  const { data: material } = await db.from("study_materials").select("id, status, moderation_note").eq("id", id.data).maybeSingle();
  if (!material) return { ok: false, error: "Material não encontrado." };
  await closeReports(id.data, outcome === "keep" ? "resolved_kept" : "dismissed", user.id, note?.trim() || null);
  // Material que saiu do ar só por causa das denúncias volta a ser exibido.
  if (outcome === "keep" && material.status === "pending_review" && material.moderation_note === AUTO_HIDE_NOTE) {
    await db.from("study_materials").update({ status: "published", moderation_note: null }).eq("id", id.data);
  }
  await audit({
    actorId: user.id,
    action: outcome === "keep" ? "report.keep" : "report.dismiss",
    targetType: "material",
    targetId: id.data,
    details: { note: note?.trim() || undefined },
  });
  refresh();
  return { ok: true, message: outcome === "keep" ? "Denúncias analisadas; o material continua no ar." : "Denúncias arquivadas." };
}

/** Suspende ou reativa uma conta. Ninguém age sobre a própria conta; só admins agem sobre a equipe. */
export async function setAccountSuspended(userId: string, suspended: boolean, reason?: string): Promise<Result> {
  const { user, isAdmin } = await requireStaff();
  const id = uuid.safeParse(userId);
  if (!id.success) return { ok: false, error: "Usuário inválido." };
  const why = noteSchema.safeParse(reason ?? "");
  if (!why.success) return { ok: false, error: why.error.issues[0]!.message };
  if (id.data === user.id) return { ok: false, error: "Você não pode alterar a própria conta por aqui." };
  const db = createSupabaseAdminClient();
  const { data: roles } = await db.from("user_roles").select("role").eq("user_id", id.data);
  if (roles?.length && !isAdmin) return { ok: false, error: "Só administradores podem suspender pessoas da equipe." };

  const { error } = await db
    .from("profiles")
    .update({ account_status: suspended ? "suspended" : "active" })
    .eq("id", id.data);
  if (error) return { ok: false, error: "Não foi possível atualizar a conta." };
  // Bloqueia também o login e a renovação de sessão no Supabase Auth.
  const { error: authError } = await db.auth.admin.updateUserById(id.data, { ban_duration: suspended ? "876000h" : "none" });
  if (authError) logger.warn("admin.ban_failed", { name: authError.name });
  await audit({
    actorId: user.id,
    action: suspended ? "user.suspend" : "user.reactivate",
    targetType: "user",
    targetId: id.data,
    details: { reason: why.data },
  });
  refresh();
  return { ok: true, message: suspended ? "Conta suspensa." : "Conta reativada." };
}

export async function setStaffRole(userId: string, role: "admin" | "moderator", grant: boolean): Promise<Result> {
  const { user } = await requireStaff("admin");
  const id = uuid.safeParse(userId);
  if (!id.success || (role !== "admin" && role !== "moderator")) return { ok: false, error: "Dados inválidos." };
  if (id.data === user.id && !grant) return { ok: false, error: "Você não pode remover o próprio papel." };
  const db = createSupabaseAdminClient();
  const { error } = grant
    ? await db.from("user_roles").upsert({ user_id: id.data, role, granted_by: user.id }, { onConflict: "user_id,role", ignoreDuplicates: true })
    : await db.from("user_roles").delete().eq("user_id", id.data).eq("role", role);
  if (error) return { ok: false, error: "Não foi possível alterar o papel." };
  await audit({ actorId: user.id, action: grant ? "role.grant" : "role.revoke", targetType: "user", targetId: id.data, details: { role } });
  refresh();
  return { ok: true, message: grant ? "Papel concedido." : "Papel removido." };
}

/** Pro de cortesia (bolsas, parcerias, suporte): registrado como assinatura manual e auditado. */
export async function grantManualPro(userId: string, days: number, reason: string): Promise<Result> {
  const { user } = await requireStaff("admin");
  const id = uuid.safeParse(userId);
  if (!id.success || !Number.isInteger(days) || days < 1 || days > 366) return { ok: false, error: "Escolha de 1 a 366 dias." };
  const why = noteSchema.safeParse(reason);
  if (!why.success) return { ok: false, error: why.error.issues[0]!.message };
  const now = new Date();
  const { error } = await createSupabaseAdminClient()
    .from("subscriptions")
    .insert({
      user_id: id.data,
      provider: "manual",
      plan_id: "pro",
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: new Date(now.getTime() + days * 86_400_000).toISOString(),
    });
  if (error) return { ok: false, error: "Não foi possível conceder o Pro." };
  await audit({ actorId: user.id, action: "plan.grant_manual", targetType: "user", targetId: id.data, details: { days, reason: why.data } });
  await notifyUser(id.data, { type: "plan_granted", title: "Você ganhou acesso ao Pro", body: `Válido por ${days} dias.`, link: "/app/assinatura" });
  refresh();
  return { ok: true, message: "Pro concedido." };
}

export async function revokeManualPro(subscriptionId: string): Promise<Result> {
  const { user } = await requireStaff("admin");
  const id = uuid.safeParse(subscriptionId);
  if (!id.success) return { ok: false, error: "Assinatura inválida." };
  const { data, error } = await createSupabaseAdminClient()
    .from("subscriptions")
    .update({ status: "canceled", canceled_at: new Date().toISOString(), current_period_end: new Date().toISOString() })
    .eq("id", id.data)
    .eq("provider", "manual")
    .select("user_id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Só assinaturas concedidas manualmente podem ser encerradas aqui." };
  await audit({ actorId: user.id, action: "plan.revoke_manual", targetType: "user", targetId: data.user_id, details: { subscription: id.data } });
  refresh();
  return { ok: true, message: "Pro de cortesia encerrado." };
}

export async function setContactStatus(messageId: string, status: "open" | "in_progress" | "closed"): Promise<Result> {
  const { user } = await requireStaff();
  const id = uuid.safeParse(messageId);
  if (!id.success || !["open", "in_progress", "closed"].includes(status)) return { ok: false, error: "Dados inválidos." };
  const { error } = await createSupabaseAdminClient().from("contact_messages").update({ status }).eq("id", id.data);
  if (error) return { ok: false, error: "Não foi possível atualizar." };
  await audit({ actorId: user.id, action: "contact.status", targetType: "contact_message", targetId: id.data, details: { status } });
  refresh();
  return { ok: true };
}

const subjectSchema = z.object({
  name: z.string().trim().min(2, "Nome curto demais.").max(60),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens.")
    .max(40),
  kind: z.enum(["discipline", "exam_prep", "other"]),
  color: z.string().regex(/^[a-z]{3,16}$/),
  icon: z.string().regex(/^[a-z0-9-]{2,40}$/),
  sortOrder: z.number().int().min(0).max(10_000),
  isActive: z.boolean(),
});

export async function saveSubject(id: string | null, input: z.input<typeof subjectSchema>): Promise<Result> {
  const { user } = await requireStaff("admin");
  const parsed = subjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const values = {
    name: parsed.data.name,
    kind: parsed.data.kind,
    color: parsed.data.color,
    icon: parsed.data.icon,
    sort_order: parsed.data.sortOrder,
    is_active: parsed.data.isActive,
  };
  const db = createSupabaseAdminClient();
  const { error } = id
    ? await db.from("subjects").update(values).eq("id", id)
    : await db.from("subjects").insert({ ...values, slug: parsed.data.slug });
  if (error?.code === "23505") return { ok: false, error: "Já existe uma matéria com esse endereço." };
  if (error) return { ok: false, error: "Não foi possível salvar a matéria." };
  await audit({
    actorId: user.id,
    action: id ? "subject.update" : "subject.create",
    targetType: "subject",
    targetId: id ?? parsed.data.slug,
    details: values,
  });
  updateTag("subjects");
  refresh();
  return { ok: true, message: "Matéria salva." };
}

const settingsSchema = z.object({
  moderation_mode: z.enum(["pre", "post"]),
  report_auto_hide_threshold: z.number().int().min(1).max(50),
  community_min_age_without_guardian: z.number().int().min(13).max(18),
  child_age_limit: z.number().int().min(12).max(16),
});

export async function saveSettings(input: z.input<typeof settingsSchema>): Promise<Result> {
  const { user } = await requireStaff("admin");
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os valores: alguns estão fora dos limites permitidos." };
  if (parsed.data.child_age_limit > parsed.data.community_min_age_without_guardian) {
    return { ok: false, error: "A idade da conta infantil não pode passar da idade mínima para publicar." };
  }
  const db = createSupabaseAdminClient();
  const { data: before } = await db.from("app_settings").select("key, value").in("key", Object.keys(parsed.data));
  for (const [key, value] of Object.entries(parsed.data)) {
    const { error } = await db.from("app_settings").update({ value, updated_by: user.id }).eq("key", key);
    if (error) return { ok: false, error: `Não foi possível salvar ${key}.` };
  }
  await audit({
    actorId: user.id,
    action: "settings.update",
    targetType: "app_settings",
    details: { before: Object.fromEntries((before ?? []).map((row) => [row.key, row.value])), after: parsed.data },
  });
  updateTag("settings");
  refresh();
  return { ok: true, message: "Configurações salvas." };
}
