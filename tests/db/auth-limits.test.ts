import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it, vi } from "vitest";

import { adminClient, supabaseAvailable } from "./helpers";

/**
 * Limites de tentativa de login contra a função real de rate limit no banco local. O Supabase
 * Auth é substituído por uma resposta de senha errada: o que se testa é quando o app para
 * de repassar tentativas, não o Auth.
 */
const state = vi.hoisted(() => ({ ip: "203.0.113.1" }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": state.ip }),
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { signInWithPassword: async () => ({ error: { code: "invalid_credentials" } }) },
  }),
}));

const available = await supabaseAvailable();
const blocked = "Muitas tentativas de entrar. Aguarde alguns minutos e tente de novo.";

describe.skipIf(!available)("limites de login", async () => {
  const { signIn } = await import("@/app/(auth)/actions");
  const { rateLimits } = await import("@/lib/security/rate-limit");

  afterAll(async () => {
    await adminClient().from("rate_limits").delete().like("key", "signin%");
  });

  async function attempt(email: string, ip: string) {
    state.ip = ip;
    const form = new FormData();
    form.set("email", email);
    form.set("password", "senha-errada-123");
    return (await signIn({}, form)).error;
  }

  it("bloqueia a mesma conta no mesmo IP depois do limite", async () => {
    const email = `limite.${randomUUID().slice(0, 8)}@example.com`;
    for (let i = 0; i < rateLimits.signIn.limit; i++) {
      expect(await attempt(email, "198.51.100.7")).toBe("E-mail ou senha incorretos.");
    }
    expect(await attempt(email, "198.51.100.7")).toBe(blocked);
    // Outra pessoa na mesma rede (mesmo IP) continua entrando.
    expect(await attempt(`outra.${randomUUID().slice(0, 8)}@example.com`, "198.51.100.7")).toBe("E-mail ou senha incorretos.");
  });

  it("bloqueia ataque distribuído contra uma conta, mesmo trocando de IP a cada tentativa", async () => {
    const email = `alvo.${randomUUID().slice(0, 8)}@example.com`;
    for (let i = 0; i < rateLimits.signInAccount.limit; i++) {
      expect(await attempt(email, `192.0.2.${i + 1}`)).toBe("E-mail ou senha incorretos.");
    }
    expect(await attempt(email, "192.0.2.250")).toBe(blocked);
  });
});
