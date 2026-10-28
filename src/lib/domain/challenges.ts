import { daysBetween } from "@/lib/domain/dates";
import { XP_RULES } from "@/lib/domain/gamification";

/** Métricas verificáveis: vêm de tabelas que só o servidor grava (ver public.weekly_activity). */
export type ChallengeMetric =
  | "flashcard_reviews"
  | "quizzes_completed"
  | "mock_exams"
  | "correct_answers"
  | "study_minutes"
  | "active_days"
  | "focus_sessions";

export type WeeklyActivity = Record<ChallengeMetric, number>;

type Template = {
  code: string;
  metric: ChallengeMetric;
  title: (target: number) => string;
  description: string;
  target: (ctx: { dailyGoalMinutes: number }) => number;
};

/**
 * Banco de desafios. Ficam de fora atividades autodeclaradas (tarefas do plano) e as
 * que dependem de IA configurada, para que todo desafio seja justo e conferível.
 */
export const challengePool: readonly Template[] = [
  {
    code: "revisoes",
    metric: "flashcard_reviews",
    title: (t) => `Revise ${t} flashcards`,
    description: "Cada revisão de cartão conta, de qualquer baralho.",
    target: () => 60,
  },
  {
    code: "minutos",
    metric: "study_minutes",
    title: (t) => `Estude ${t} minutos`,
    description: "Revisões, quizzes, simulados e cronômetro de foco somam.",
    // Quatro dias de meta diária, arredondado de 10 em 10 (entre 1 h e 10 h).
    target: ({ dailyGoalMinutes }) => Math.min(600, Math.max(60, Math.round((dailyGoalMinutes * 4) / 10) * 10)),
  },
  {
    code: "quizzes",
    metric: "quizzes_completed",
    title: (t) => `Conclua ${t} quizzes`,
    description: "Vale quiz com pelo menos 5 questões, entregue e corrigido.",
    target: () => 3,
  },
  {
    code: "dias",
    metric: "active_days",
    title: (t) => `Estude em ${t} dias diferentes`,
    description: "Um pouco por dia rende mais que tudo de uma vez.",
    target: () => 4,
  },
  {
    code: "acertos",
    metric: "correct_answers",
    title: (t) => `Acerte ${t} questões`,
    description: "Questões corrigidas em quizzes e simulados entregues.",
    target: () => 30,
  },
  {
    code: "foco",
    metric: "focus_sessions",
    title: (t) => `Faça ${t} sessões de foco de 20 minutos`,
    description: "Use o cronômetro de foco no plano de estudos.",
    target: () => 3,
  },
  {
    code: "simulado",
    metric: "mock_exams",
    title: () => "Faça um simulado completo",
    description: "Entregue um simulado com tempo, como na prova.",
    target: () => 1,
  },
];

export type WeeklyChallenge = {
  code: string;
  metric: ChallengeMetric;
  title: string;
  description: string;
  target: number;
  reward: number;
};

const EPOCH_MONDAY = "2024-01-01";
export const CHALLENGES_PER_WEEK = 3;

/**
 * Três desafios por semana, os mesmos para todo mundo (rodízio determinístico pelo
 * número da semana). Com 7 modelos e passo 2, os três escolhidos nunca se repetem.
 */
export function challengesForWeek(weekStart: string, ctx: { dailyGoalMinutes: number }): WeeklyChallenge[] {
  const weekIndex = Math.floor(daysBetween(EPOCH_MONDAY, weekStart) / 7);
  const n = challengePool.length;
  const start = ((weekIndex % n) + n) % n;
  return Array.from({ length: CHALLENGES_PER_WEEK }, (_, i) => {
    const template = challengePool[(start + i * 2) % n]!;
    const target = template.target(ctx);
    return {
      code: template.code,
      metric: template.metric,
      title: template.title(target),
      description: template.description,
      target,
      reward: XP_RULES.weeklyChallenge.amount,
    };
  });
}

/** Identificador do resgate: um por desafio por semana (xp_transactions é único por fonte). */
export function challengeSourceId(weekStart: string, code: string): string {
  return `${weekStart}:${code}`;
}

export function challengeProgress(challenge: WeeklyChallenge, activity: WeeklyActivity): { value: number; percent: number; done: boolean } {
  const value = Math.max(0, activity[challenge.metric] ?? 0);
  return { value, percent: Math.min(100, Math.round((value / challenge.target) * 100)), done: value >= challenge.target };
}
