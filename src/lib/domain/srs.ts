import { fsrs, generatorParameters, Rating, State, type Card, type Grade } from "ts-fsrs";

/**
 * Repetição espaçada com FSRS (o mesmo algoritmo do Anki moderno). O servidor
 * recalcula cada revisão com o próprio relógio; o cliente usa as mesmas funções
 * apenas para mostrar a prévia dos intervalos nos botões.
 */
export type CardStateName = "new" | "learning" | "review" | "relearning";

export type SrsFields = {
  state: CardStateName;
  due_at: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  last_review_at: string | null;
};

export const ratings = [
  { value: Rating.Again as Grade, label: "Errei", key: "1", tone: "danger" },
  { value: Rating.Hard as Grade, label: "Difícil", key: "2", tone: "warning" },
  { value: Rating.Good as Grade, label: "Bom", key: "3", tone: "primary" },
  { value: Rating.Easy as Grade, label: "Fácil", key: "4", tone: "success" },
] as const;

export const scheduler = fsrs(
  generatorParameters({
    request_retention: 0.9,
    maximum_interval: 365,
    // Sem aleatoriedade: a prévia mostrada no botão é exatamente o que o servidor grava.
    enable_fuzz: false,
    enable_short_term: true,
  }),
);

const toState: Record<CardStateName, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

const fromState: Record<State, CardStateName> = {
  [State.New]: "new",
  [State.Learning]: "learning",
  [State.Review]: "review",
  [State.Relearning]: "relearning",
};

export function toFsrsCard(row: SrsFields): Card {
  return {
    due: new Date(row.due_at),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: toState[row.state],
    last_review: row.last_review_at ? new Date(row.last_review_at) : undefined,
  };
}

export function fromFsrsCard(card: Card): Omit<SrsFields, "last_review_at"> {
  return {
    state: fromState[card.state],
    due_at: card.due.toISOString(),
    stability: Math.max(0, card.stability),
    difficulty: Math.max(0, card.difficulty),
    elapsed_days: Math.max(0, Math.round(card.elapsed_days)),
    scheduled_days: Math.max(0, Math.round(card.scheduled_days)),
    learning_steps: Math.max(0, card.learning_steps),
    reps: card.reps,
    lapses: card.lapses,
  };
}

export function scheduleReview(row: SrsFields, rating: Grade, now: Date) {
  return fromFsrsCard(scheduler.next(toFsrsCard(row), now, rating).card);
}

/** Texto curto do próximo intervalo: "1 min", "10 min", "3 dias", "2 meses". */
export function formatInterval(from: Date, to: Date): string {
  const minutes = Math.max(1, Math.round((to.getTime() - from.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? "dia" : "dias"}`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.round((days / 365) * 10) / 10;
  return `${String(years).replace(".", ",")} ${years === 1 ? "ano" : "anos"}`;
}

export function previewIntervals(row: SrsFields, now: Date): Record<Grade, string> {
  const preview = scheduler.repeat(toFsrsCard(row), now);
  return {
    [Rating.Again]: formatInterval(now, preview[Rating.Again].card.due),
    [Rating.Hard]: formatInterval(now, preview[Rating.Hard].card.due),
    [Rating.Good]: formatInterval(now, preview[Rating.Good].card.due),
    [Rating.Easy]: formatInterval(now, preview[Rating.Easy].card.due),
  } as Record<Grade, string>;
}

export function isGrade(value: unknown): value is Grade {
  return value === Rating.Again || value === Rating.Hard || value === Rating.Good || value === Rating.Easy;
}

export const cardStateLabels: Record<CardStateName, string> = {
  new: "Novo",
  learning: "Aprendendo",
  review: "Em revisão",
  relearning: "Reaprendendo",
};
