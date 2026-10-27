"use server";

import { getSessionUser } from "@/lib/auth/session";
import { isServiceRoleConfigured } from "@/lib/env/server";
import { logger } from "@/lib/logger";
import { checkRateLimit, rateLimits } from "@/lib/security/rate-limit";
import { getClientIp, keyedHash } from "@/lib/security/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { type ActionState, fieldErrorsOf, formDataToObject } from "@/lib/validation/common";
import { contactSchema } from "@/lib/validation/contact";

export async function sendContactMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = contactSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    if (fieldErrors.website) {
      // Robô preencheu o campo invisível: responde como sucesso sem gravar nada.
      return { ok: true, message: "Mensagem enviada." };
    }
    return { error: "Revise os campos destacados.", fieldErrors };
  }

  if (!isServiceRoleConfigured()) {
    return { error: "O formulário de contato ainda não está configurado neste ambiente." };
  }

  const ip = await getClientIp();
  const allowed = await checkRateLimit(`contact:${keyedHash(ip).slice(0, 32)}`, rateLimits.contactForm);
  if (!allowed) {
    return { error: "Você enviou muitas mensagens em pouco tempo. Tente novamente em uma hora." };
  }

  const user = await getSessionUser();
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("contact_messages").insert({
    user_id: user?.id ?? null,
    name: parsed.data.name,
    email: parsed.data.email,
    topic: parsed.data.topic,
    message: parsed.data.message,
    reference_url: parsed.data.referenceUrl,
  });

  if (error) {
    logger.error("contact.insert_failed", { code: error.code });
    return { error: "Não foi possível enviar agora. Tente novamente em alguns minutos." };
  }

  return {
    ok: true,
    message:
      parsed.data.topic === "privacy"
        ? "Pedido recebido. Respondemos pedidos sobre dados pessoais no prazo da LGPD, pelo e-mail informado."
        : "Mensagem enviada. Respondemos pelo e-mail informado.",
  };
}
