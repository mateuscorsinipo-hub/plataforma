import type Stripe from "stripe";

import { getStripe, syncSubscription } from "@/lib/billing/stripe";
import { serverEnv } from "@/lib/env/server";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const MAX_BODY = 512 * 1024;

/**
 * Webhook do Stripe: só aceita eventos com assinatura válida, processa cada evento
 * uma vez (billing_events) e sempre relê a assinatura na API para não depender da
 * ordem de chegada. Erro devolve 500 para o Stripe tentar de novo.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) return new Response("Pagamentos não configurados.", { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Assinatura ausente.", { status: 400 });
  const body = await request.text();
  if (body.length > MAX_BODY) return new Response("Corpo grande demais.", { status: 413 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, serverEnv.stripe.webhookSecret);
  } catch {
    logger.warn("billing.webhook_bad_signature");
    return new Response("Assinatura inválida.", { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const objectId = (event.data.object as { id?: string }).id ?? null;
  const { error: insertError } = await admin.from("billing_events").insert({ id: event.id, provider: "stripe", type: event.type, object_id: objectId });
  if (insertError?.code === "23505") {
    const { data: previous } = await admin.from("billing_events").select("processed_at").eq("id", event.id).single();
    if (previous?.processed_at) return Response.json({ received: true, duplicate: true });
  } else if (insertError) {
    logger.error("billing.event_insert_failed", { code: insertError.code });
    return new Response("Erro ao registrar o evento.", { status: 500 });
  }

  try {
    await handleEvent(stripe, event);
    await admin.from("billing_events").update({ processed_at: new Date().toISOString(), error: null }).eq("id", event.id);
    return Response.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "unknown";
    logger.error("billing.webhook_failed", { type: event.type, message });
    await admin.from("billing_events").update({ error: message }).eq("id", event.id);
    return new Response("Falha ao processar.", { status: 500 });
  }
}

async function handleEvent(stripe: Stripe, event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "subscription" && session.subscription) {
        const id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        await syncSubscription(await stripe.subscriptions.retrieve(id));
      }
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed": {
      const result = await syncSubscription(await stripe.subscriptions.retrieve(event.data.object.id));
      if (result && event.type === "customer.subscription.deleted") {
        await notify(result.userId, "subscription_ended", "Sua assinatura Pro terminou", "Você voltou ao plano Grátis. Seus materiais continuam salvos.");
      }
      return;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) return;
      const admin = createSupabaseAdminClient();
      const { data } = await admin.from("billing_customers").select("user_id").eq("provider_customer_id", customerId).maybeSingle();
      if (data) {
        await notify(data.user_id, "payment_failed", "Pagamento não aprovado", "Atualize a forma de pagamento para manter o Pro.");
      }
      return;
    }
    default:
      return;
  }
}

async function notify(userId: string, type: string, title: string, body: string) {
  const admin = createSupabaseAdminClient();
  await admin.from("notifications").insert({ user_id: userId, type, title, body, link: "/app/assinatura" });
}
