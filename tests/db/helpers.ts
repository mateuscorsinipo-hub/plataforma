import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

export const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

export type Client = SupabaseClient<Database>;

/** Os testes de banco precisam do Supabase local (`npx supabase start`). */
export async function supabaseAvailable(): Promise<boolean> {
  if (!publishableKey || !secretKey) return false;
  try {
    const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: publishableKey }, signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export function adminClient(): Client {
  return createClient<Database>(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type TestUser = { id: string; email: string; client: Client };

const created: string[] = [];

export async function createTestUser(options: { birthDate?: string; displayName?: string } = {}): Promise<TestUser> {
  const admin = adminClient();
  const email = `teste.${randomUUID().slice(0, 8)}@example.com`;
  const password = "senha1234";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: options.displayName ?? "Pessoa Teste",
      birth_date: options.birthDate ?? "2000-01-15",
      accepted_terms: true,
    },
  });
  if (error || !data.user) throw error ?? new Error("usuário não criado");
  created.push(data.user.id);
  const client = createClient<Database>(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

export async function cleanupUsers(): Promise<void> {
  const admin = adminClient();
  for (const id of created.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
}

export async function subjectId(slug = "matematica"): Promise<string> {
  const { data } = await adminClient().from("subjects").select("id").eq("slug", slug).single();
  if (!data) throw new Error(`disciplina ${slug} não encontrada`);
  return data.id;
}

export function yearsAgo(years: number): string {
  const now = new Date();
  return `${now.getUTCFullYear() - years}-01-15`;
}
