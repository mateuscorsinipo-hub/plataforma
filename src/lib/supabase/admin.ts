import "server-only";

import { createClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";
import type { Database } from "@/lib/supabase/database.types";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Cliente com a chave secreta: ignora o RLS. Use só para operações que o
 * próprio usuário não pode fazer (XP, consumo, moderação, webhooks) e sempre
 * depois de autorizar a ação no servidor.
 */
export function createSupabaseAdminClient() {
  if (!serverEnv.supabaseSecretKey) {
    throw new Error("SUPABASE_SECRET_KEY não configurada.");
  }
  if (!adminClient) {
    adminClient = createClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return adminClient;
}

export type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
