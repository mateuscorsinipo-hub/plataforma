import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../../src/lib/supabase/database.types";

export const admin = () =>
  createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.SUPABASE_SECRET_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export type E2EUser = { id: string; email: string; password: string };

/** Estudante com onboarding concluído (criado direto pelo Supabase Auth local). */
export async function createStudent(options: { name?: string; birthDate?: string; role?: "admin" | "moderator" } = {}): Promise<E2EUser> {
  const db = admin();
  const email = `e2e.${randomUUID().slice(0, 8)}@example.com`;
  const password = "senha-e2e-1234";
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: options.name ?? "Estudante E2E", birth_date: options.birthDate ?? "2004-06-15", accepted_terms: true },
  });
  if (error || !data.user) throw error ?? new Error("usuário não criado");
  await db.from("profiles").update({ onboarding_completed_at: new Date().toISOString(), school_stage: "medio", grade_year: 2 }).eq("id", data.user.id);
  if (options.role) await db.from("user_roles").insert({ user_id: data.user.id, role: options.role });
  return { id: data.user.id, email, password };
}

export async function deleteUser(user: E2EUser) {
  await admin().auth.admin.deleteUser(user.id);
}

export async function login(page: Page, user: E2EUser) {
  await page.goto("/entrar");
  await page.fill("#email", user.email);
  await page.fill("#password", user.password);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/app/);
}

/** Erros de console e de página durante o teste (devem ficar vazios). */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // Recursos bloqueados de propósito pela ausência de credenciais externas não são falhas da página.
    if (/Failed to load resource: the server responded with a status of (401|404)/.test(text)) return;
    errors.push(text.slice(0, 300));
  });
  return errors;
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "a página não deve rolar na horizontal").toBeLessThanOrEqual(1);
}

/** Acessibilidade: nenhuma violação séria ou crítica do axe (WCAG 2.1 A/AA). */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`),
  ).toEqual([]);
}
