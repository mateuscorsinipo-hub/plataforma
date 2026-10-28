"use server";

import { redirect } from "next/navigation";

import { getCurrentProfile, getSessionUser } from "@/lib/auth/session";
import { createCheckoutSession, createPortalSession, getStripe } from "@/lib/billing/stripe";
import { logger } from "@/lib/logger";
import { checkRateLimit, rateLimits } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Result = { ok: false; error: string };

/** Abre o checkout do Stripe. O plano só muda quando o webhook confirmar o pagamento. */
export async function startCheckout(): Promise<Result> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sua sessão expirou. Entre de novo." };
  const profile = await getCurrentProfile();
  if (!profile || profile.account_status !== "active") return { ok: false, error: "Sua conta não pode contratar planos agora." };
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "O pagamento ainda não está disponível nesta instalação." };
  if (!(await checkRateLimit(`checkout:${user.id}`, rateLimits.checkout))) {
    return { ok: false, error: "Muitas tentativas em pouco tempo. Aguarde alguns minutos." };
  }
  const supabase = await createSupabaseServerClient();
  const { data: active } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", "stripe")
    .in("status", ["active", "trialing", "past_due"])
    .limit(1)
    .maybeSingle();
  if (active) return { ok: false, error: "Você já tem uma assinatura. Use “Gerenciar assinatura”." };

  let url: string;
  try {
    url = await createCheckoutSession(stripe, { userId: user.id, email: user.email });
  } catch (error) {
    logger.error("billing.checkout_failed", { name: error instanceof Error ? error.name : "unknown" });
    return { ok: false, error: "Não foi possível abrir o pagamento. Tente de novo em instantes." };
  }
  redirect(url);
}

/** Portal do Stripe: trocar cartão, ver faturas e cancelar. */
export async function openBillingPortal(): Promise<Result> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sua sessão expirou. Entre de novo." };
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "O pagamento ainda não está disponível nesta instalação." };
  const admin = createSupabaseAdminClient();
  const { data: customer } = await admin.from("billing_customers").select("provider_customer_id").eq("user_id", user.id).maybeSingle();
  if (!customer) return { ok: false, error: "Não encontramos uma assinatura paga nesta conta." };
  let url: string;
  try {
    url = await createPortalSession(stripe, customer.provider_customer_id);
  } catch (error) {
    logger.error("billing.portal_failed", { name: error instanceof Error ? error.name : "unknown" });
    return { ok: false, error: "Não foi possível abrir o portal de pagamento agora." };
  }
  redirect(url);
}
