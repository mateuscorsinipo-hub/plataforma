/**
 * Variáveis públicas (vão para o navegador). Acesse sempre por nome literal:
 * o Next.js só substitui `process.env.NEXT_PUBLIC_*` escritos assim no código.
 */
function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function parseCents(value: string | undefined): number | null {
  if (!value) return null;
  const cents = Number.parseInt(value, 10);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

export const publicEnv = {
  siteUrl: trimSlash(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  supabaseUrl: trimSlash(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  proPriceCents: parseCents(process.env.NEXT_PUBLIC_PRO_PRICE_CENTS),
  /** Ligue só depois de configurar o provedor Google no painel do Supabase. */
  googleAuthEnabled: process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true",
  company: {
    name: process.env.NEXT_PUBLIC_COMPANY_NAME || null,
    document: process.env.NEXT_PUBLIC_COMPANY_DOCUMENT || null,
    address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || null,
    contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || null,
    dpoEmail: process.env.NEXT_PUBLIC_DPO_EMAIL || null,
  },
} as const;

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabasePublishableKey);
}
