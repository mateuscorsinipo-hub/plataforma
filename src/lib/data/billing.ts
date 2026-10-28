import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SubscriptionView = {
  provider: string;
  planId: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

/** Assinatura mais recente do usuário (RLS: só a própria). */
export async function getLatestSubscription(userId: string): Promise<SubscriptionView | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("provider, plan_id, status, current_period_end, cancel_at_period_end")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data
    ? { provider: data.provider, planId: data.plan_id, status: data.status, currentPeriodEnd: data.current_period_end, cancelAtPeriodEnd: data.cancel_at_period_end }
    : null;
}

export type UsageEntry = { id: number; feature: string; quantity: number; createdAt: string; model: string | null };

/** Histórico de consumo (o registro é feito no servidor a cada uso de IA ou processamento). */
export async function listUsageHistory(userId: string, limit = 50): Promise<UsageEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("usage_records")
    .select("id, feature, quantity, created_at, metadata")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => {
    const meta = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? (row.metadata as Record<string, unknown>) : {};
    return { id: row.id, feature: row.feature, quantity: row.quantity, createdAt: row.created_at, model: typeof meta.model === "string" ? meta.model : null };
  });
}
