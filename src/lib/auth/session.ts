import "server-only";

import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/env/public";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Usuário autenticado, verificado pelo Supabase (assinatura e validade do JWT).
 * Memoizado por requisição. `connection()` marca a leitura como feita no momento
 * da requisição: a validação depende do relógio e não pode entrar em prefetch.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});

export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(nextPath ? `/entrar?next=${encodeURIComponent(nextPath)}` : "/entrar");
  }
  return user;
}

export const getCurrentProfile = cache(async (): Promise<ProfileRow | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data;
});

/**
 * Exige um estudante com conta ativa e onboarding concluído.
 * Contas pendentes de responsável ou suspensas vão para as telas próprias.
 */
export async function requireStudent(nextPath?: string): Promise<{ user: SessionUser; profile: ProfileRow }> {
  const user = await requireUser(nextPath);
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/entrar?erro=perfil");
  }
  if (profile.account_status === "suspended") {
    redirect("/conta-suspensa");
  }
  if (profile.account_status === "pending_guardian") {
    redirect("/responsavel/pendente");
  }
  if (!profile.onboarding_completed_at) {
    redirect("/onboarding");
  }
  return { user, profile };
}

export const getStaffRoles = cache(async (): Promise<Array<Database["public"]["Enums"]["app_role"]>> => {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  return (data ?? []).map((row) => row.role);
});

/** Área administrativa: o papel vem do banco (tabela user_roles), nunca do cliente. */
export async function requireStaff(minimum: "moderator" | "admin" = "moderator") {
  const user = await requireUser("/admin");
  const roles = await getStaffRoles();
  const allowed = minimum === "admin" ? roles.includes("admin") : roles.includes("admin") || roles.includes("moderator");
  if (!allowed) {
    notFound();
  }
  return { user, roles, isAdmin: roles.includes("admin") };
}
