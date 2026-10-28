"use server";

import { redirect } from "next/navigation";

import { requestGuardianConsent } from "@/lib/auth/guardian";
import { publicEnv } from "@/lib/env/public";
import { isEmailConfigured, isServiceRoleConfigured } from "@/lib/env/server";
import { logger } from "@/lib/logger";
import { checkRateLimit, rateLimits } from "@/lib/security/rate-limit";
import { getClientIp, keyedHash } from "@/lib/security/request";
import { safeNextPath } from "@/lib/supabase/proxy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CHILD_AGE_LIMIT,
  ageOn,
  emailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";
import { type ActionState, fieldErrorsOf, formDataToObject } from "@/lib/validation/common";

async function ipKey(scope: string): Promise<string> {
  return `${scope}:${keyedHash(await getClientIp()).slice(0, 32)}`;
}

const genericError = "Não foi possível concluir agora. Tente novamente em instantes.";

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return { error: "Revise os campos destacados.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  // Três limites: conta + IP (força bruta comum), conta de qualquer IP (ataque distribuído)
  // e IP (escolas e redes móveis compartilham IP, então este é alto). O e-mail entra só
  // como hash no nome da chave.
  const email = parsed.data.email.toLowerCase();
  const [pairOk, accountOk, ipOk] = await Promise.all([
    checkRateLimit(`signin-pair:${keyedHash(`${email}|${await getClientIp()}`).slice(0, 32)}`, rateLimits.signIn),
    checkRateLimit(`signin-account:${keyedHash(email).slice(0, 32)}`, rateLimits.signInAccount),
    checkRateLimit(await ipKey("signin"), rateLimits.signInIp),
  ]);
  if (!pairOk || !accountOk || !ipOk) {
    return { error: "Muitas tentativas de entrar. Aguarde alguns minutos e tente de novo." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        error: "Confirme seu e-mail antes de entrar. Procure a mensagem do Grifo na sua caixa de entrada (e no spam).",
        fieldErrors: { resend: ["email_not_confirmed"] },
      };
    }
    if (error.code === "invalid_credentials") {
      return { error: "E-mail ou senha incorretos." };
    }
    if (error.code === "over_request_rate_limit") {
      return { error: "Muitas tentativas. Aguarde alguns minutos." };
    }
    logger.warn("auth.signin_failed", { code: error.code ?? "unknown" });
    return { error: genericError };
  }

  redirect(safeNextPath(parsed.data.next));
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return { error: "Revise os campos destacados.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const input = parsed.data;
  const needsGuardian = ageOn(input.birthDate) < CHILD_AGE_LIMIT;

  if (needsGuardian && !(isEmailConfigured() && isServiceRoleConfigured())) {
    return {
      error:
        "No momento não conseguimos criar contas para menores de 12 anos, porque o envio do pedido de autorização ao responsável não está disponível. Tente novamente mais tarde.",
    };
  }
  if (!(await checkRateLimit(await ipKey("signup"), rateLimits.signUp))) {
    return { error: "Muitos cadastros a partir desta conexão. Tente novamente em uma hora." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${publicEnv.siteUrl}/auth/callback?next=/onboarding`,
      data: {
        display_name: input.displayName,
        birth_date: input.birthDate,
        accepted_terms: true,
      },
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return { error: "Escolha uma senha mais forte.", fieldErrors: { password: ["Use letras, números e pelo menos 8 caracteres."] } };
    }
    if (error.code === "over_email_send_rate_limit") {
      return { error: "Muitos e-mails enviados há pouco. Aguarde alguns minutos e tente de novo." };
    }
    if (error.code === "signup_disabled") {
      return { error: "Novos cadastros estão temporariamente fechados." };
    }
    logger.warn("auth.signup_failed", { code: error.code ?? "unknown" });
    return { error: genericError };
  }

  // Supabase devolve um usuário sem identidades quando o e-mail já existe.
  // Para não revelar contas existentes, a resposta ao usuário é a mesma.
  const isNewUser = Boolean(data.user && (data.user.identities?.length ?? 0) > 0);

  if (needsGuardian && isNewUser && data.user) {
    const consent = await requestGuardianConsent({
      userId: data.user.id,
      guardianName: input.guardianName ?? "",
      guardianEmail: input.guardianEmail ?? "",
      studentName: input.displayName,
    });
    if (!consent.ok) {
      logger.error("auth.guardian_request_failed", { reason: consent.reason });
    }
  }

  redirect(needsGuardian ? "/cadastro/confirme?responsavel=1" : "/cadastro/confirme");
}

export async function resendConfirmation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) {
    return { error: "Informe um e-mail válido." };
  }
  if (!(await checkRateLimit(await ipKey("resend"), rateLimits.passwordReset))) {
    return { error: "Aguarde um pouco antes de pedir outro e-mail." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.data,
    options: { emailRedirectTo: `${publicEnv.siteUrl}/auth/callback?next=/onboarding` },
  });
  if (error && error.code !== "over_email_send_rate_limit") {
    logger.warn("auth.resend_failed", { code: error.code ?? "unknown" });
  }
  return { ok: true, message: "Se houver um cadastro pendente com este e-mail, enviamos um novo link de confirmação." };
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return { error: "Informe um e-mail válido.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  if (!(await checkRateLimit(await ipKey("reset"), rateLimits.passwordReset))) {
    return { error: "Muitos pedidos. Tente novamente em uma hora." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.siteUrl}/auth/callback?next=/redefinir-senha`,
  });
  if (error && error.code !== "over_email_send_rate_limit") {
    logger.warn("auth.reset_failed", { code: error.code ?? "unknown" });
  }
  // Mesma resposta exista ou não a conta, para não revelar e-mails cadastrados.
  return {
    ok: true,
    message: "Se existir uma conta com este e-mail, você vai receber um link para criar uma nova senha em alguns minutos.",
  };
}

export async function resetPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return { error: "Revise os campos destacados.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return { error: "O link de recuperação expirou. Peça um novo." };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return { error: "A nova senha precisa ser diferente da atual.", fieldErrors: { password: ["Escolha outra senha."] } };
    }
    if (error.code === "weak_password") {
      return { error: "Escolha uma senha mais forte.", fieldErrors: { password: ["Use letras, números e pelo menos 8 caracteres."] } };
    }
    logger.warn("auth.update_password_failed", { code: error.code ?? "unknown" });
    return { error: genericError };
  }
  redirect("/app?senha=atualizada");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
