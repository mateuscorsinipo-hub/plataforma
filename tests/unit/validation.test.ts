import { describe, expect, it } from "vitest";

import { ageOn, passwordSchema, signUpSchema } from "@/lib/validation/auth";
import { contactSchema } from "@/lib/validation/contact";
import { safeNextPath } from "@/lib/supabase/proxy";

const base = {
  displayName: "Ana",
  email: "ana@example.com",
  password: "senha1234",
  birthDate: "2008-05-10",
  acceptTerms: "on",
};

describe("cadastro", () => {
  it("aceita um cadastro válido de maior de 12 anos sem responsável", () => {
    expect(signUpSchema.safeParse(base).success).toBe(true);
  });

  it("exige aceite dos termos", () => {
    const result = signUpSchema.safeParse({ ...base, acceptTerms: undefined });
    expect(result.success).toBe(false);
  });

  it("exige dados do responsável para menores de 12 anos", () => {
    const tenYearsAgo = `${new Date().getUTCFullYear() - 10}-01-15`;
    const result = signUpSchema.safeParse({ ...base, birthDate: tenYearsAgo });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("guardianName");
      expect(paths).toContain("guardianEmail");
    }
  });

  it("recusa o próprio e-mail como e-mail do responsável", () => {
    const tenYearsAgo = `${new Date().getUTCFullYear() - 10}-01-15`;
    const result = signUpSchema.safeParse({
      ...base,
      birthDate: tenYearsAgo,
      guardianName: "Maria Responsável",
      guardianEmail: "ana@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("aplica a política de senha (letras e números, 8+)", () => {
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
    expect(passwordSchema.safeParse("abcdefgh").success).toBe(false);
    expect(passwordSchema.safeParse("abc123").success).toBe(false);
    expect(passwordSchema.safeParse("abc12345").success).toBe(true);
  });

  it("calcula idade completa considerando o aniversário", () => {
    expect(ageOn("2010-10-28", new Date("2026-10-27T12:00:00Z"))).toBe(15);
    expect(ageOn("2010-10-27", new Date("2026-10-27T12:00:00Z"))).toBe(16);
  });
});

describe("contato", () => {
  it("exige link do material em pedidos de direitos autorais", () => {
    const result = contactSchema.safeParse({
      name: "Editora X",
      email: "juridico@editora.com",
      topic: "copyright",
      message: "Este material reproduz capítulos do nosso livro.",
    });
    expect(result.success).toBe(false);
  });

  it("aceita mensagem de suporte simples", () => {
    const result = contactSchema.safeParse({
      name: "Ana",
      email: "ana@example.com",
      topic: "support",
      message: "Não consigo enviar meu PDF.",
    });
    expect(result.success).toBe(true);
  });
});

describe("redirecionamento seguro", () => {
  it("só aceita caminhos internos", () => {
    expect(safeNextPath("/app/tutor")).toBe("/app/tutor");
    expect(safeNextPath("https://malicioso.com")).toBe("/app");
    expect(safeNextPath("//malicioso.com")).toBe("/app");
    expect(safeNextPath("/\\malicioso.com")).toBe("/app");
    expect(safeNextPath(null)).toBe("/app");
  });
});
