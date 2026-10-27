import { z } from "zod";

import { isValidTimezone } from "@/lib/domain/dates";
import { emailSchema, passwordSchema } from "@/lib/validation/auth";
import { checkboxSchema, optionalText, toArray } from "@/lib/validation/common";
import { dailyGoalOptions, difficultyOptions, goalOptions, periodOptions } from "@/lib/validation/onboarding";

const stages = ["fundamental_1", "fundamental_2", "medio", "pre_vestibular", "superior", "outro"] as const;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use pelo menos 3 caracteres.")
  .max(24, "Use no máximo 24 caracteres.")
  .regex(/^[a-z0-9](?:[a-z0-9_.]{1,22})[a-z0-9]$/, "Use letras minúsculas, números, ponto ou sublinhado (sem começar ou terminar com eles).")
  .refine((value) => !value.includes(".."), "Não use dois pontos seguidos.");

export const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Informe como quer ser chamado.").max(60),
  username: usernameSchema,
  bio: optionalText(280),
  schoolStage: z
    .enum(stages)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  gradeYear: z
    .union([z.coerce.number().int().min(1).max(9), z.literal("")])
    .optional()
    .transform((value) => (typeof value === "number" ? value : null)),
});

export function readProfileForm(formData: FormData) {
  return {
    displayName: formData.get("displayName") ?? "",
    username: formData.get("username") ?? "",
    bio: formData.get("bio") ?? "",
    schoolStage: formData.get("schoolStage") || null,
    gradeYear: formData.get("gradeYear") ?? "",
  };
}

type GoalKey = keyof typeof goalOptions;
type DifficultyKey = keyof typeof difficultyOptions;
type PeriodKey = keyof typeof periodOptions;

export const preferencesSchema = z.object({
  dailyGoalMinutes: z.coerce
    .number()
    .int()
    .refine((value) => (dailyGoalOptions as readonly number[]).includes(value) || (value >= 5 && value <= 600), "Meta inválida."),
  studyWeekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Escolha pelo menos um dia."),
  preferredPeriod: z
    .enum(Object.keys(periodOptions) as [PeriodKey, ...PeriodKey[]])
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  goals: z.array(z.enum(Object.keys(goalOptions) as [GoalKey, ...GoalKey[]])).max(6),
  difficulties: z.array(z.enum(Object.keys(difficultyOptions) as [DifficultyKey, ...DifficultyKey[]])).max(8),
  explanationLevel: z.enum(["simple", "balanced", "deep"]),
  timezone: z.string().refine(isValidTimezone, "Fuso horário inválido."),
  emailReminders: checkboxSchema,
});

export function readPreferencesForm(formData: FormData) {
  return {
    dailyGoalMinutes: formData.get("dailyGoalMinutes") ?? "30",
    studyWeekdays: toArray(formData.getAll("studyWeekdays")),
    preferredPeriod: formData.get("preferredPeriod") || null,
    goals: toArray(formData.getAll("goals")),
    difficulties: toArray(formData.getAll("difficulties")),
    explanationLevel: formData.get("explanationLevel") ?? "balanced",
    timezone: formData.get("timezone") ?? "America/Sao_Paulo",
    emailReminders: formData.get("emailReminders") ?? undefined,
  };
}

export const privacySchema = z.object({
  profileVisibility: z.enum(["public", "private"]),
  showInLeaderboard: checkboxSchema,
  showStatsPublicly: checkboxSchema,
  showAchievementsPublicly: checkboxSchema,
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: passwordSchema,
    confirm: z.string(),
  })
  .refine((value) => value.newPassword === value.confirm, { path: ["confirm"], message: "As senhas não coincidem." });

export const emailChangeSchema = z.object({ email: emailSchema });

export const deleteAccountSchema = z.object({
  confirmation: z.string().refine((value) => value.trim().toUpperCase() === "EXCLUIR", "Digite EXCLUIR para confirmar."),
  password: z.string().optional(),
});
