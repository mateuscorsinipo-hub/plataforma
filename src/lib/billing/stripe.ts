import "server-only";

import Stripe from "stripe";

import { plans, type PlanId } from "@/lib/config/plans";
import { publicEnv } from "@/lib/env/public";
import { isBillingConfigured, serverEnv } from "@/lib/env/server";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];

let client: Stripe | null = null;

/** Cliente do Stripe, só quando chave, segredo do webhook e preço estão configurados. */
export function getStripe(): Stripe | null {
  if (!isBillingConfigured()) return null;
  client ??= new Stripe(serverEnv.stripe.secretKey, { maxNetworkRetries: 2, timeout: 20_000 });
  return client;
}

const knownStatuses = new Set<SubscriptionStatus>(["trialing", "active", "past_due", "canceled", "incomplete", "incomplete_expired", "unpaid", "paused"]);

export function mapSubscriptionStatus(status: string): SubscriptionStatus {
  return knownStatuses.has(status as SubscriptionStatus) ? (status as SubscriptionStatus) : "incomplete";
}

/** Plano correspondente ao preço da assinatura (preço desconhecido não vira Pro). */
export function planForPrice(priceId: string | null | undefined): PlanId | null {
  if (priceId && priceId === serverEnv.stripe.priceProMonthly) return "pro";
  return null;
}

/** Cliente do Stripe vinculado ao usuário (criado uma vez e guardado em billing_customers). */
export async function getOrCreateCustomer(stripe: Stripe, userId: string, email: string | null): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin.from("billing_customers").select("provider_customer_id").eq("user_id", userId).maybeSingle();
  if (existing) return existing.provider_customer_id;
  const customer = await stripe.customers.create(
    { email: email ?? undefined, metadata: { user_id: userId }, preferred_locales: ["pt-BR"] },
    { idempotencyKey: `customer:${userId}` },
  );
  const { error } = await admin.from("billing_customers").insert({ user_id: userId, provider: "stripe", provider_customer_id: customer.id });
  if (error?.code === "23505") {
    // Outra requisição criou primeiro: usa o registro que ficou no banco.
    const { data } = await admin.from("billing_customers").select("provider_customer_id").eq("user_id", userId).single();
    return data!.provider_customer_id;
  }
  if (error) throw new Error(`billing_customer_insert_failed:${error.code}`);
  return customer.id;
}

export async function createCheckoutSession(stripe: Stripe, params: { userId: string; email: string | null }): Promise<string> {
  const customer = await getOrCreateCustomer(stripe, params.userId, params.email);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: params.userId,
    line_items: [{ price: serverEnv.stripe.priceProMonthly, quantity: 1 }],
    subscription_data: { metadata: { user_id: params.userId } },
    allow_promotion_codes: true,
    locale: "pt-BR",
    success_url: `${publicEnv.siteUrl}/app/assinatura?status=sucesso`,
    cancel_url: `${publicEnv.siteUrl}/app/assinatura?status=cancelado`,
  });
  if (!session.url) throw new Error("checkout_without_url");
  return session.url;
}

export async function createPortalSession(stripe: Stripe, customerId: string): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${publicEnv.siteUrl}/app/assinatura`, locale: "pt-BR" });
  return session.url;
}

async function userForSubscription(subscription: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = subscription.metadata?.user_id;
  if (fromMetadata && /^[0-9a-f-]{36}$/i.test(fromMetadata)) return fromMetadata;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("billing_customers").select("user_id").eq("provider_customer_id", customerId).maybeSingle();
  return data?.user_id ?? null;
}

const toIso = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000).toISOString() : null);

/** Grava o estado da assinatura vindo do Stripe (fonte da verdade do plano pago). */
export async function syncSubscription(subscription: Stripe.Subscription): Promise<{ userId: string; status: SubscriptionStatus } | null> {
  const userId = await userForSubscription(subscription);
  if (!userId) {
    logger.warn("billing.subscription_without_user", { subscription: subscription.id });
    return null;
  }
  const item = subscription.items.data[0];
  const plan = planForPrice(item?.price?.id);
  const status = mapSubscriptionStatus(subscription.status);
  const admin = createSupabaseAdminClient();
  const values = {
    user_id: userId,
    provider: "stripe",
    provider_subscription_id: subscription.id,
    plan_id: plan ?? "unknown_price",
    status,
    current_period_start: toIso(item?.current_period_start),
    current_period_end: toIso(item?.current_period_end),
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: toIso(subscription.canceled_at),
  };
  const { data: existing } = await admin.from("subscriptions").select("id").eq("provider_subscription_id", subscription.id).maybeSingle();
  let { error } = existing
    ? await admin.from("subscriptions").update(values).eq("id", existing.id)
    : await admin.from("subscriptions").insert(values);
  if (error?.code === "23505") {
    // Dois eventos da mesma assinatura chegaram juntos: o segundo atualiza.
    ({ error } = await admin.from("subscriptions").update(values).eq("provider_subscription_id", subscription.id));
  }
  if (error) throw new Error(`subscription_sync_failed:${error.code}`);
  return { userId, status };
}

export function planLabel(planId: string): string {
  return planId in plans ? plans[planId as PlanId].name : "Plano desconhecido";
}
