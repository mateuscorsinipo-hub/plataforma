import { addDays } from "@/lib/domain/dates";

/**
 * Regras de progresso. A concessão de XP acontece só no servidor (award_xp,
 * executável apenas com a chave secreta), com idempotência por evento e tetos diários.
 */
export const XP_RULES = {
  flashcardReview: { amount: 2, dailyCap: 60 },
  quizCompleted: { base: 10, perCorrect: 2, dailyCap: 150 },
  mockExamCompleted: { base: 30, perCorrect: 2, dailyCap: 300 },
  planTaskCompleted: { amount: 8, dailyCap: 80 },
  dailyGoalMet: { amount: 20 },
  weeklyChallenge: { amount: 50 },
  materialPublished: { amount: 25, dailyCap: 50 },
  focusSession: { perTenMinutes: 3, dailyCap: 45 },
} as const;

/** XP necessário para atingir o nível n: 50 · (n − 1)². Mesma fórmula de public.level_for_xp. */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level));
  return 50 * (n - 1) ** 2;
}

export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1);
}

export function levelProgress(xp: number): { level: number; currentLevelXp: number; nextLevelXp: number; percent: number } {
  const level = levelForXp(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const percent = Math.round(((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100);
  return { level, currentLevelXp, nextLevelXp, percent: Math.min(100, Math.max(0, percent)) };
}

/** Sequência válida só se o último dia ativo foi hoje ou ontem (no fuso do estudante). */
export function effectiveStreak(currentStreak: number, lastActiveDate: string | null, today: string): number {
  if (!lastActiveDate) return 0;
  return lastActiveDate === today || lastActiveDate === addDays(today, -1) ? currentStreak : 0;
}

export function quizXp(kind: "quiz" | "mock_exam", correct: number, total: number): number {
  if (total <= 0) return 0;
  const rule = kind === "quiz" ? XP_RULES.quizCompleted : XP_RULES.mockExamCompleted;
  return rule.base + rule.perCorrect * Math.max(0, Math.min(correct, total));
}

export const leagues = {
  bronze: { label: "Bronze", color: "#8A4A0B" },
  prata: { label: "Prata", color: "#5B6785" },
  ouro: { label: "Ouro", color: "#8A6A00" },
  platina: { label: "Platina", color: "#0B6770" },
  diamante: { label: "Diamante", color: "#1D45C4" },
} as const;

export type LeagueId = keyof typeof leagues;

export function leagueLabel(league: string | null | undefined): string {
  return leagues[(league ?? "bronze") as LeagueId]?.label ?? "Bronze";
}

/** Desafios da semana: metas medidas a partir dos dados da própria semana. */
export const weeklyChallenges = [
  { code: "revisor", title: "Revise 100 flashcards", metric: "reviews", target: 100 },
  { code: "praticante", title: "Conclua 5 quizzes", metric: "quizzes", target: 5 },
  { code: "constante", title: "Estude em 5 dias diferentes", metric: "active_days", target: 5 },
  { code: "maratona", title: "Some 3 horas de estudo", metric: "study_minutes", target: 180 },
] as const;

export type WeeklyChallengeMetric = (typeof weeklyChallenges)[number]["metric"];
