import "server-only";

/**
 * Variáveis exclusivas do servidor. Este módulo não pode ser importado por
 * componentes de cliente (o pacote server-only quebra o build se isso ocorrer).
 */
export type AIProviderId = "anthropic" | "openai_compatible";

function readInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function readProvider(value: string | undefined): AIProviderId {
  return value === "openai_compatible" ? "openai_compatible" : "anthropic";
}

const provider = readProvider(process.env.AI_PROVIDER);
const defaultModel = provider === "anthropic" ? "claude-opus-5-5" : "";
const model = process.env.AI_MODEL?.trim() || defaultModel;

export const serverEnv = {
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  ai: {
    provider,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
    openaiBaseUrl: process.env.OPENAI_BASE_URL?.trim() || undefined,
    /** O modelo do serviço compatível aceita imagens? Padrão: sim na OpenAI oficial, não nos demais. */
    openaiVision: process.env.OPENAI_VISION ? process.env.OPENAI_VISION === "true" : !process.env.OPENAI_BASE_URL?.trim(),
    model,
    modelLight: process.env.AI_MODEL_LIGHT?.trim() || model,
    timeoutMs: readInt(process.env.AI_REQUEST_TIMEOUT_MS, 120_000, 10_000, 600_000),
  },
  appHashSecret: process.env.APP_HASH_SECRET ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
  email: {
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    from: process.env.EMAIL_FROM ?? "",
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    priceProMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
  },
} as const;

export function isServiceRoleConfigured(): boolean {
  return serverEnv.supabaseSecretKey.length > 0;
}

export function isAIConfigured(): boolean {
  const { provider: id, anthropicApiKey, openaiApiKey, model: name } = serverEnv.ai;
  if (!name) return false;
  return id === "anthropic" ? anthropicApiKey.length > 0 : openaiApiKey.length > 0;
}

export function isEmailConfigured(): boolean {
  return Boolean(serverEnv.email.resendApiKey && serverEnv.email.from);
}

export function isBillingConfigured(): boolean {
  const { secretKey, webhookSecret, priceProMonthly } = serverEnv.stripe;
  return Boolean(secretKey && webhookSecret && priceProMonthly);
}
