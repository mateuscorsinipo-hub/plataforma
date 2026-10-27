import "server-only";

import { createClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env/public";
import type { Database } from "@/lib/supabase/database.types";

let anonClient: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Cliente anônimo (sem sessão) para dados públicos, como a lista de disciplinas e
 * a biblioteca. Pode ser usado dentro de funções com "use cache" porque não lê cookies.
 */
export function createSupabasePublicClient() {
  if (!anonClient) {
    anonClient = createClient<Database>(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return anonClient;
}
