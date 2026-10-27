import { z } from "zod";

import { isValidDateString, isValidTimezone } from "@/lib/domain/dates";
import { birthDateSchema } from "@/lib/validation/auth";
import { toArray } from "@/lib/validation/common";

export const goalOptions = {
  enem: "ENEM",
  vestibular: "Vestibulares",
  school: "Notas na escola",
  olympiad: "Olimpíadas",
  concurso: "Concursos",
  learning: "Aprender por conta própria",
} as const;

export const difficultyOptions = {
  organization: "Organizar a rotina",
  focus: "Manter o foco",
  memorization: "Memorizar conteúdo",
  math: "Cálculos e exatas",
  writing: "Redação",
  reading: "Interpretação de texto",
  time: "Falta de tempo",
  motivation: "Motivação",
} as const;

export const periodOptions = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite",
  night: "Madrugada",
} as const;

export const dailyGoalOptions = [15, 30, 45, 60, 90, 120] as const;

const schoolStages = ["fundamental_1", "fundamental_2", "medio", "pre_vestibular", "superior", "outro"] as const;

type GoalKey = keyof typeof goalOptions;
type DifficultyKey = keyof typeof difficultyOptions;
type PeriodKey = keyof typeof periodOptions;

const goalKeys = Object.keys(goalOptions) as [GoalKey, ...GoalKey[]];
const difficultyKeys = Object.keys(difficultyOptions) as [DifficultyKey, ...DifficultyKey[]];
const periodKeys = Object.keys(periodOptions) as [PeriodKey, ...PeriodKey[]];

export const examEntrySchema = z.object({
  title: z.string().trim().min(2, "Dê um nome para a prova.").max(120, "Nome muito longo."),
  date: z.string().refine(isValidDateString, "Data inválida."),
  subjectId: z.uuid().nullable(),
});

export type ExamEntry = z.infer<typeof examEntrySchema>;

/**
 * Converte o FormData do onboarding (campos repetidos para listas) em objeto validável.
 */
export function readOnboardingForm(formData: FormData) {
  const titles = toArray(formData.getAll("examTitle"));
  const dates = toArray(formData.getAll("examDate"));
  const subjects = toArray(formData.getAll("examSubject"));
  const exams = titles
    .map((title, index) => ({ title, date: dates[index] ?? "", subjectId: subjects[index] || null }))
    .filter((exam) => exam.title.trim() || exam.date);

  const grade = formData.get("gradeYear");
  return {
    displayName: formData.get("displayName") ?? "",
    birthDate: formData.get("birthDate") || undefined,
    acceptTerms: formData.get("acceptTerms") ?? undefined,
    schoolStage: formData.get("schoolStage") || null,
    gradeYear: typeof grade === "string" && grade ? Number.parseInt(grade, 10) : null,
    subjectIds: toArray(formData.getAll("subjectIds")),
    goals: toArray(formData.getAll("goals")),
    difficulties: toArray(formData.getAll("difficulties")),
    dailyGoalMinutes: Number.parseInt(String(formData.get("dailyGoalMinutes") ?? "30"), 10),
    studyWeekdays: toArray(formData.getAll("studyWeekdays")).map((d) => Number.parseInt(d, 10)),
    preferredPeriod: formData.get("preferredPeriod") || null,
    timezone: formData.get("timezone") || "America/Sao_Paulo",
    exams,
  };
}

export function onboardingSchema(options: { needsBirthDate: boolean; needsTerms: boolean }) {
  return z.object({
    displayName: z.string().trim().min(2, "Informe como quer ser chamado.").max(60, "Use no máximo 60 caracteres."),
    birthDate: options.needsBirthDate ? birthDateSchema : z.string().optional(),
    acceptTerms: options.needsTerms
      ? z.literal("on", { error: "É preciso aceitar os termos e a política de privacidade." })
      : z.any().optional(),
    schoolStage: z.enum(schoolStages).nullable(),
    gradeYear: z.number().int().min(1).max(9).nullable(),
    subjectIds: z.array(z.uuid()).max(20, "Escolha no máximo 20 matérias."),
    goals: z.array(z.enum(goalKeys)).max(6),
    difficulties: z.array(z.enum(difficultyKeys)).max(8),
    dailyGoalMinutes: z.number().int().min(5).max(600),
    studyWeekdays: z
      .array(z.number().int().min(0).max(6))
      .min(1, "Escolha pelo menos um dia da semana.")
      .max(7)
      .transform((days) => [...new Set(days)].sort()),
    preferredPeriod: z.enum(periodKeys).nullable(),
    timezone: z.string().refine(isValidTimezone, "Fuso horário inválido."),
    exams: z.array(examEntrySchema).max(5, "Cadastre até 5 provas agora; depois dá para adicionar mais no calendário."),
  });
}

export type OnboardingInput = z.infer<ReturnType<typeof onboardingSchema>>;
