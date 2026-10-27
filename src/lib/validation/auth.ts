import { z } from "zod";

import { brand } from "@/lib/config/brand";

export const CHILD_AGE_LIMIT = brand.minimumAge;

export const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(72, "Use no máximo 72 caracteres.")
  .refine((value) => /[a-zA-Z]/.test(value) && /\d/.test(value), "Use letras e números na senha.");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Informe um e-mail válido.").max(254, "E-mail muito longo."));

/** Idade completa em anos numa data de referência (padrão: hoje, UTC). */
export function ageOn(birthDate: string, reference = new Date()): number {
  const [y, m, d] = birthDate.split("-").map((part) => Number.parseInt(part, 10));
  if (!y || !m || !d) return Number.NaN;
  let age = reference.getUTCFullYear() - y;
  const monthDiff = reference.getUTCMonth() + 1 - m;
  if (monthDiff < 0 || (monthDiff === 0 && reference.getUTCDate() < d)) age -= 1;
  return age;
}

export const birthDateSchema = z
  .string({ error: "Informe sua data de nascimento." })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe sua data de nascimento.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Data inválida.")
  .refine((value) => {
    const age = ageOn(value);
    return age >= 5 && age <= 120;
  }, "Confira a data de nascimento.");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha.").max(72),
  next: z.string().optional(),
});

export const signUpSchema = z
  .object({
    displayName: z.string().trim().min(2, "Informe como quer ser chamado.").max(60, "Use no máximo 60 caracteres."),
    email: emailSchema,
    password: passwordSchema,
    birthDate: birthDateSchema,
    acceptTerms: z.literal("on", { error: "É preciso aceitar os termos e a política de privacidade." }),
    guardianName: z.string().trim().max(120).optional(),
    guardianEmail: z.string().trim().toLowerCase().max(254).optional(),
  })
  .superRefine((value, ctx) => {
    if (ageOn(value.birthDate) < CHILD_AGE_LIMIT) {
      if (!value.guardianName || value.guardianName.length < 3) {
        ctx.addIssue({ code: "custom", path: ["guardianName"], message: "Informe o nome do responsável." });
      }
      const guardianEmail = z.email().safeParse(value.guardianEmail ?? "");
      if (!guardianEmail.success) {
        ctx.addIssue({ code: "custom", path: ["guardianEmail"], message: "Informe o e-mail do responsável." });
      } else if (guardianEmail.data === value.email) {
        ctx.addIssue({
          code: "custom",
          path: ["guardianEmail"],
          message: "O e-mail do responsável precisa ser diferente do seu.",
        });
      }
    }
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((value) => value.password === value.confirm, { path: ["confirm"], message: "As senhas não coincidem." });

export type SignUpInput = z.infer<typeof signUpSchema>;
