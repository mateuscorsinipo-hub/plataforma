import "server-only";

import { cache } from "react";

import { plans, usagePeriodKey, type PlanDefinition, type PlanId, type UsageFeature } from "@/lib/config/plans";
import { localDateString, safeTimezone } from "@/lib/domain/dates";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

/**
 * Plano efetivo do usuário, lido do banco (assinaturas gravadas só pelo servidor:
 * webhook verificado ou concessão manual registrada em auditoria). Nunca do cliente.
 */
export const getPlanForUser = cache(async (userId: string): Promise<PlanDefinition> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("plan_id, status, current_period_end")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);
  const now = Date.now();
  const active = (data ?? []).find(
    (row) =>
      ACTIVE_STATUSES.has(row.status) &&
      (!row.current_period_end || new Date(row.current_period_end).getTime() > now) &&
      row.plan_id in plans,
  );
  return plans[(active?.plan_id as PlanId | undefined) ?? "free"];
});

export const getUserTimezone = cache(async (userId: string): Promise<string> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("user_preferences").select("timezone").eq("user_id", userId).maybeSingle();
  return safeTimezone(data?.timezone);
});

export type Consumption =
  | { ok: true; recordId: number; used: number; limit: number }
  | { ok: false; used: number; limit: number; window: "day" | "month" };

/** Reserva o uso antes de chamar a IA (transação com trava por usuário e recurso). */
export async function consumeFeature(params: {
  userId: string;
  plan: PlanDefinition;
  feature: UsageFeature;
  timezone: string;
  quantity?: number;
  metadata?: Record<string, Json>;
}): Promise<Consumption> {
  const rule = params.plan.limits[params.feature];
  const periodKey = usagePeriodKey(rule.window, localDateString(params.timezone));
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("consume_usage", {
    p_user_id: params.userId,
    p_feature: params.feature,
    p_quantity: params.quantity ?? 1,
    p_limit: rule.limit,
    p_period_key: periodKey,
    p_metadata: { plan: params.plan.id, ...params.metadata },
  });
  const row = data?.[0];
  if (error || !row) {
    logger.error("usage.consume_failed", { feature: params.feature, code: error?.code ?? "no_row" });
    throw new Error("usage_unavailable");
  }
  if (!row.allowed || row.record_id === null) {
    return { ok: false, used: row.used, limit: rule.limit, window: rule.window };
  }
  return { ok: true, recordId: row.record_id, used: row.used, limit: rule.limit };
}

/** Devolve o crédito quando a operação falhou sem entregar resultado ao estudante. */
export async function refundUsage(recordId: number): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("usage_records").delete().eq("id", recordId);
  if (error) logger.warn("usage.refund_failed", { code: error.code });
}

/** Acrescenta tokens consumidos ao registro (para indicadores de custo no painel). */
export async function annotateUsage(recordId: number, metadata: Record<string, Json>): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("usage_records").select("metadata").eq("id", recordId).maybeSingle();
  const current = (data?.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata) ? data.metadata : {}) as Record<string, Json>;
  await admin.from("usage_records").update({ metadata: { ...current, ...metadata } }).eq("id", recordId);
}

export type UsageSummaryItem = { feature: UsageFeature; used: number; limit: number; window: "day" | "month"; remaining: number };

/** Consumo do período atual de cada recurso (para exibir "restam X hoje"). */
export async function getUsageSummary(userId: string, plan: PlanDefinition, timezone: string): Promise<Record<UsageFeature, UsageSummaryItem>> {
  const today = localDateString(timezone);
  const features = Object.keys(plan.limits) as UsageFeature[];
  const keys = features.map((feature) => usagePeriodKey(plan.limits[feature].window, today));
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("usage_records")
    .select("feature, quantity, period_key")
    .eq("user_id", userId)
    .in("period_key", [...new Set(keys)]);
  const summary = {} as Record<UsageFeature, UsageSummaryItem>;
  features.forEach((feature, index) => {
    const rule = plan.limits[feature];
    const used = (data ?? [])
      .filter((row) => row.feature === feature && row.period_key === keys[index])
      .reduce((sum, row) => sum + row.quantity, 0);
    summary[feature] = { feature, used, limit: rule.limit, window: rule.window, remaining: Math.max(0, rule.limit - used) };
  });
  return summary;
}

export function limitReachedMessage(feature: UsageFeature, window: "day" | "month", planId: PlanId): string {
  const period = window === "day" ? "hoje" : "este mês";
  const what: Record<UsageFeature, string> = {
    ai_chat_message: "as mensagens com o tutor",
    ai_generation: "as gerações do estúdio",
    file_processing: "o processamento de arquivos",
    ai_grading: "as correções de dissertativas",
  };
  const base = `Você usou todo o limite do plano ${plans[planId].name} para ${what[feature]} ${period}.`;
  return planId === "free" ? `${base} O limite renova no próximo período, ou você pode conhecer o plano Pro.` : `${base} O limite renova no próximo período.`;
}
