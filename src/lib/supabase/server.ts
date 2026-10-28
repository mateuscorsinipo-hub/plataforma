import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { publicEnv } from "@/lib/env/public";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Cliente do Supabase com a sessão do usuário (cookies). Respeita o RLS.
 * Em Server Components a escrita de cookies falha silenciosamente; o proxy
 * já renova a sessão a cada navegação.
 * `connection()`: a sessão depende do relógio (validade do token), então nada lido
 * com ela pode entrar em prefetch reaproveitável, nem mesmo em generateMetadata.
 */
export async function createSupabaseServerClient() {
  await connection();
  const cookieStore = await cookies();
  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado durante a renderização de um Server Component: ignorado.
        }
      },
    },
  });
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
