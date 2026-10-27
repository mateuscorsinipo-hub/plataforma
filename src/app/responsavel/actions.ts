"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { hashToken, requestGuardianConsent } from "@/lib/auth/guardian";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import { deleteAccountCompletely } from "@/lib/data/account-deletion";
import { isEmailConfigured, isServiceRoleConfigured } from "@/lib/env/server";
import { logger } from "@/lib/logger";
import { checkRateLimit, rateLimits } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { type ActionState, fieldErrorsOf, formDataToObject } from "@/lib/validation/common";

const inviteSchema = z.object({
  guardianName: z.string().trim().min(3, "Informe o nome do responsável.").max(120),
  guardianEmail: z.email("Informe um e-mail válido.").max(254),
});

export async function sendGuardianInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/responsavel/pendente");
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Perfil não encontrado." };

  const parsed = inviteSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: "Revise os campos.", fieldErrors: fieldErrorsOf(parsed.error) };
  if (user.email && parsed.data.guardianEmail.toLowerCase() === user.email.toLowerCase()) {
    return { fieldErrors: { guardianEmail: ["Use o e-mail do responsável, não o seu."] }, error: "Revise os campos." };
  }
  if (!isEmailConfigured() || !isServiceRoleConfigured()) {
    return { error: "O envio de e-mails não está configurado neste ambiente. Tente novamente mais tarde." };
  }
  if (!(await checkRateLimit(`guardian:${user.id}`, rateLimits.guardianInvite))) {
    return { error: "Você já enviou vários pedidos hoje. Tente novamente amanhã." };
  }

  const result = await requestGuardianConsent({
    userId: user.id,
    guardianName: parsed.data.guardianName,
    guardianEmail: parsed.data.guardianEmail,
    studentName: profile.display_name || profile.username,
  });
  if (!result.ok) {
    return { error: "Não conseguimos enviar o e-mail agora. Tente novamente em alguns minutos." };
  }
  return { ok: true, message: "Pedido enviado. Avise seu responsável para procurar o e-mail do Grifo." };
}

const decisionSchema = z.object({
  token: z.string().min(20).max(200),
  decision: z.enum(["grant", "deny"]),
});

export async function decideGuardianConsent(formData: FormData): Promise<void> {
  const parsed = decisionSchema.safeParse(formDataToObject(formData));
  if (!parsed.success || !isServiceRoleConfigured()) {
    redirect("/responsavel/confirmar?resultado=invalido");
  }
  const admin = createSupabaseAdminClient();
  const { data: consent } = await admin
    .from("guardian_consents")
    .select("id, user_id, status, expires_at")
    .eq("token_hash", hashToken(parsed.data.token))
    .maybeSingle();

  if (!consent || consent.status !== "pending" || new Date(consent.expires_at) < new Date()) {
    redirect("/responsavel/confirmar?resultado=invalido");
  }

  if (parsed.data.decision === "grant") {
    await admin
      .from("guardian_consents")
      .update({ status: "granted", decided_at: new Date().toISOString() })
      .eq("id", consent.id);
    // Reavalia as regras de idade no banco (libera a conta e mantém as proteções).
    await admin.from("profiles").update({ account_status: "active" }).eq("id", consent.user_id).neq("account_status", "suspended");
    logger.info("guardian.consent_granted");
    redirect("/responsavel/confirmar?resultado=autorizado");
  }

  await admin
    .from("guardian_consents")
    .update({ status: "revoked", decided_at: new Date().toISOString() })
    .eq("id", consent.id);
  // Sem consentimento não há base legal para manter os dados da criança: a conta é excluída.
  const { data: profile } = await admin.from("profiles").select("birth_date, account_status").eq("id", consent.user_id).maybeSingle();
  if (profile?.account_status === "pending_guardian") {
    await deleteAccountCompletely(consent.user_id);
  }
  logger.info("guardian.consent_denied");
  redirect("/responsavel/confirmar?resultado=recusado");
}
