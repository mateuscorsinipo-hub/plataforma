import { addDays, daysBetween, weekday } from "@/lib/domain/dates";
import type { Database } from "@/lib/supabase/database.types";

export type TaskType = Database["public"]["Enums"]["task_type"];

export const taskTypeLabels: Record<TaskType, string> = {
  study: "Estudo do conteúdo",
  summary: "Resumo",
  flashcards: "Flashcards",
  quiz: "Quiz",
  exercises: "Exercícios",
  mock_exam: "Simulado",
  review: "Revisão",
};

export type PlanSubjectInput = {
  subjectId: string;
  name: string;
  topics: string[];
  /** 1 = tranquila, 2 = normal, 3 = difícil (aparece mais vezes). */
  weight: 1 | 2 | 3;
};

export type PlanInput = {
  startDate: string;
  examDate: string;
  weekdays: number[];
  dailyMinutes: number;
  level: "beginner" | "intermediate" | "advanced";
  subjects: PlanSubjectInput[];
};

export type PlannedTask = {
  date: string;
  type: TaskType;
  subjectId: string | null;
  topic: string | null;
  title: string;
  description: string | null;
  minutes: number;
  priority: 1 | 2 | 3;
  position: number;
};

export const MAX_PLAN_DAYS = 365;
export const MAX_PLAN_TASKS = 900;

/** Dias de estudo entre o início e a véspera da prova, nos dias da semana escolhidos. */
export function studyDays(startDate: string, examDate: string, weekdays: number[]): string[] {
  const allowed = new Set(weekdays);
  const days: string[] = [];
  const last = addDays(examDate, -1);
  for (let day = startDate; day <= last && days.length < MAX_PLAN_DAYS; day = addDays(day, 1)) {
    if (allowed.has(weekday(day))) days.push(day);
  }
  return days;
}

type Topic = { subjectId: string; subjectName: string; topic: string; weight: number };

/** Fila intercalada de tópicos: matérias difíceis aparecem com mais frequência. */
export function interleaveTopics(subjects: PlanSubjectInput[]): Topic[] {
  const queues = subjects.map((s) => ({
    weight: s.weight,
    items: (s.topics.length ? s.topics : [`Visão geral de ${s.name}`, `Pontos principais de ${s.name}`, `Exercícios de ${s.name}`]).map(
      (topic) => ({ subjectId: s.subjectId, subjectName: s.name, topic, weight: s.weight }),
    ),
  }));
  const result: Topic[] = [];
  let round = 0;
  while (queues.some((q) => q.items.length)) {
    for (const queue of queues) {
      // Peso 3: entra em toda rodada; peso 2: duas de cada três; peso 1: uma de cada duas.
      const turn = queue.weight >= 3 || (queue.weight === 2 ? round % 3 !== 2 : round % 2 === 0);
      if (turn && queue.items.length) result.push(queue.items.shift()!);
    }
    round += 1;
    if (round > 10_000) break;
  }
  return result;
}

const studyMinutesByLevel = { beginner: 40, intermediate: 35, advanced: 30 } as const;

/**
 * Gera o cronograma: fase de conteúdo (estudo + prática + revisões espaçadas em
 * 1, 3 e 7 dias) e fase final de revisão com simulados. Determinístico e testável.
 */
export function generatePlan(input: PlanInput): PlannedTask[] {
  const days = studyDays(input.startDate, input.examDate, input.weekdays);
  if (!days.length || !input.subjects.length) return [];
  const capacity = Math.max(15, input.dailyMinutes);
  const finalDays = days.length >= 10 ? Math.min(14, Math.max(2, Math.round(days.length * 0.15))) : days.length >= 4 ? 1 : 0;
  const contentDays = days.slice(0, days.length - finalDays);
  const reviewPhase = days.slice(days.length - finalDays);
  const queue = interleaveTopics(input.subjects);
  const reviews = new Map<string, Topic[]>();
  const tasks: PlannedTask[] = [];
  const dayIndex = new Map(days.map((d, i) => [d, i]));

  const scheduleReview = (topic: Topic, fromIndex: number, gap: number) => {
    const target = days[fromIndex + gap];
    if (!target || dayIndex.get(target)! >= contentDays.length) return;
    reviews.set(target, [...(reviews.get(target) ?? []), topic]);
  };

  let cursor = 0;
  let recycled = false;
  for (const [index, day] of contentDays.entries()) {
    let left = capacity;
    let position = 0;
    const push = (task: Omit<PlannedTask, "date" | "position">) => {
      tasks.push({ ...task, date: day, position: position++ });
      left -= task.minutes;
    };

    // 1) Revisões espaçadas que vencem hoje (curtas, prioridade alta).
    for (const topic of reviews.get(day) ?? []) {
      if (left < 10) break;
      push({
        type: "review",
        subjectId: topic.subjectId,
        topic: topic.topic,
        title: `Revisar: ${topic.topic}`,
        description: "Revisão rápida para fixar: releia seu resumo e refaça os cartões deste tema.",
        minutes: Math.min(15, left),
        priority: 1,
      });
    }

    // 2) Conteúdo novo, seguido de prática do mesmo tema quando houver tempo.
    while (left >= 20) {
      if (cursor >= queue.length) {
        if (!queue.length) break;
        cursor = 0;
        recycled = true;
      }
      const topic = queue[cursor++]!;
      const study = Math.min(studyMinutesByLevel[input.level], left);
      push({
        type: recycled ? "review" : "study",
        subjectId: topic.subjectId,
        topic: topic.topic,
        title: recycled ? `Aprofundar: ${topic.topic}` : `Estudar: ${topic.topic}`,
        description: recycled
          ? `${topic.subjectName}: retome o tema com exercícios mais difíceis e anote suas dúvidas.`
          : `${topic.subjectName}: estude o conteúdo e faça um resumo curto com suas palavras.`,
        minutes: study,
        priority: topic.weight >= 3 ? 1 : 2,
      });
      if (left >= 15) {
        push({
          type: input.level === "advanced" ? "exercises" : index % 2 === 0 ? "quiz" : "flashcards",
          subjectId: topic.subjectId,
          topic: topic.topic,
          title: input.level === "advanced" ? `Exercícios: ${topic.topic}` : index % 2 === 0 ? `Quiz: ${topic.topic}` : `Flashcards: ${topic.topic}`,
          description: "Pratique logo depois de estudar: é o que mais ajuda a lembrar.",
          minutes: Math.min(15, left),
          priority: 2,
        });
      }
      if (!recycled) {
        scheduleReview(topic, index, 1);
        scheduleReview(topic, index, 3);
        scheduleReview(topic, index, 7);
      }
      // Um tema novo por dia em planos curtos; dois quando o tempo diário é grande.
      if (capacity < 90) break;
    }
    if (tasks.length >= MAX_PLAN_TASKS) break;
  }

  // 3) Reta final: simulados intercalados com revisões gerais por matéria.
  const bySubject = [...input.subjects].sort((a, b) => b.weight - a.weight);
  reviewPhase.forEach((day, i) => {
    let position = 0;
    if (i % 3 === 0 || i === reviewPhase.length - 1) {
      tasks.push({
        date: day,
        type: "mock_exam",
        subjectId: null,
        topic: null,
        title: i === reviewPhase.length - 1 ? "Simulado final" : "Simulado completo",
        description: "Faça com tempo marcado, como na prova. Depois, revise os erros.",
        minutes: Math.min(capacity, 180),
        priority: 1,
        position: position++,
      });
      return;
    }
    const subject = bySubject[i % bySubject.length]!;
    tasks.push({
      date: day,
      type: "review",
      subjectId: subject.subjectId,
      topic: null,
      title: `Revisão geral: ${subject.name}`,
      description: "Releia resumos, revise flashcards atrasados e refaça questões que você errou.",
      minutes: Math.min(capacity, 60),
      priority: 1,
      position: position++,
    });
    if (capacity - 60 >= 15) {
      tasks.push({
        date: day,
        type: "flashcards",
        subjectId: subject.subjectId,
        topic: null,
        title: `Flashcards: ${subject.name}`,
        description: "Revise os cartões vencidos desta matéria.",
        minutes: Math.min(30, capacity - 60),
        priority: 2,
        position: position++,
      });
    }
  });

  return tasks.slice(0, MAX_PLAN_TASKS);
}

export type ExistingTask = { id: string; date: string; minutes: number; priority: number; status: "pending" | "done" | "skipped" };

/**
 * Reorganiza tarefas atrasadas nos próximos dias de estudo com folga, sem passar
 * da prova. O que não couber até a véspera é sugerido como "pular" (menor prioridade primeiro).
 */
export function adaptPlan(params: {
  tasks: ExistingTask[];
  today: string;
  examDate: string;
  weekdays: number[];
  dailyMinutes: number;
}): { moves: { id: string; date: string }[]; skips: string[] } {
  const overdue = params.tasks
    .filter((t) => t.status === "pending" && t.date < params.today)
    .sort((a, b) => a.priority - b.priority || a.date.localeCompare(b.date));
  if (!overdue.length) return { moves: [], skips: [] };
  const days = studyDays(params.today, params.examDate, params.weekdays);
  const load = new Map<string, number>();
  for (const t of params.tasks) {
    if (t.status === "pending" && t.date >= params.today) load.set(t.date, (load.get(t.date) ?? 0) + t.minutes);
  }
  // Permite até 25% acima da meta diária para absorver o atraso.
  const limit = Math.round(params.dailyMinutes * 1.25);
  const moves: { id: string; date: string }[] = [];
  const skips: string[] = [];
  for (const task of overdue) {
    const target = days.find((day) => (load.get(day) ?? 0) + task.minutes <= limit);
    if (target) {
      moves.push({ id: task.id, date: target });
      load.set(target, (load.get(target) ?? 0) + task.minutes);
    } else {
      skips.push(task.id);
    }
  }
  return { moves, skips };
}

/** Próximo dia de estudo depois de `from` (para adiar uma tarefa). */
export function nextStudyDay(from: string, weekdays: number[], examDate: string): string | null {
  const allowed = new Set(weekdays);
  for (let day = addDays(from, 1); daysBetween(day, examDate) > 0; day = addDays(day, 1)) {
    if (allowed.has(weekday(day))) return day;
  }
  return null;
}
