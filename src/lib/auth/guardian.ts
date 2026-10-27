import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { emailLayout, escapeHtml, sendEmail } from "@/lib/email/send";
import { publicEnv } from "@/lib/env/public";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const CONSENT_TTL_DAYS = 14;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Cria um pedido de consentimento e envia o link ao responsável.
 * O token só existe no e-mail; o banco guarda apenas o hash.
 */
export async function requestGuardianConsent(params: {
  userId: string;
  guardianName: string;
  guardianEmail: string;
  studentName: string;
}): Promise<{ ok: true } | { ok: false; reason: "email_unavailable" | "db_error" }> {
  const token = randomBytes(32).toString("base64url");
  const admin = createSupabaseAdminClient();
  const expiresAt = new Date(Date.now() + CONSENT_TTL_DAYS * 86_400_000).toISOString();

  await admin
    .from("guardian_consents")
    .update({ status: "expired" })
    .eq("user_id", params.userId)
    .eq("status", "pending");

  const { error } = await admin.from("guardian_consents").insert({
    user_id: params.userId,
    guardian_name: params.guardianName,
    guardian_email: params.guardianEmail,
    token_hash: hashToken(token),
    expires_at: expiresAt,
  });
  if (error) {
    logger.error("guardian.insert_failed", { code: error.code });
    return { ok: false, reason: "db_error" };
  }

  const link = `${publicEnv.siteUrl}/responsavel/confirmar?token=${encodeURIComponent(token)}`;
  const name = escapeHtml(params.guardianName);
  const student = escapeHtml(params.studentName);
  const result = await sendEmail({
    to: params.guardianEmail,
    subject: `${params.studentName} pediu sua autorização para usar o Grifo`,
    text: `Olá, ${params.guardianName}. ${params.studentName} criou uma conta no Grifo, uma plataforma de estudos com inteligência artificial, e informou você como responsável. Como a pessoa tem menos de 12 anos, a conta só é liberada com a sua autorização. Para ler o que coletamos e decidir, acesse: ${link} (válido por ${CONSENT_TTL_DAYS} dias). Se você não reconhece este pedido, ignore esta mensagem.`,
    html: emailLayout(
      "Pedido de autorização",
      `<p style="font-size:15px;line-height:1.6;color:#3A4664">Olá, ${name}. <strong>${student}</strong> criou uma conta no Grifo, uma plataforma de estudos com inteligência artificial, e informou você como responsável.</p>
<p style="font-size:15px;line-height:1.6;color:#3A4664">Como a pessoa tem menos de 12 anos, a conta só é liberada com a sua autorização (LGPD, art. 14). Na página abaixo você vê quais dados são tratados e decide.</p>
<p style="margin:24px 0"><a href="${link}" style="display:inline-block;padding:12px 20px;background:#2453E6;color:#FFFFFF;border-radius:10px;text-decoration:none;font-weight:bold">Ver o pedido e decidir</a></p>
<p style="font-size:13px;line-height:1.6;color:#5B6785">O link vale por ${CONSENT_TTL_DAYS} dias. Se você não reconhece este pedido, ignore esta mensagem.</p>`,
    ),
  });
  if (!result.sent) {
    return { ok: false, reason: "email_unavailable" };
  }
  return { ok: true };
}
