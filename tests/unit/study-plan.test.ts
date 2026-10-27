import { describe, expect, it } from "vitest";

import { weekday } from "@/lib/domain/dates";
import { adaptPlan, generatePlan, interleaveTopics, nextStudyDay, studyDays, type PlanInput } from "@/lib/domain/study-plan";

const base: PlanInput = {
  startDate: "2026-11-02",
  examDate: "2026-12-14",
  weekdays: [1, 2, 3, 4, 5],
  dailyMinutes: 60,
  level: "intermediate",
  subjects: [
    { subjectId: "mat", name: "Matemática", topics: ["Funções", "Geometria", "Probabilidade"], weight: 3 },
    { subjectId: "bio", name: "Biologia", topics: ["Citologia", "Genética"], weight: 2 },
    { subjectId: "his", name: "História", topics: [], weight: 1 },
  ],
};

describe("dias de estudo", () => {
  it("usa só os dias escolhidos e termina na véspera da prova", () => {
    const days = studyDays("2026-11-02", "2026-11-09", [1, 3, 5]);
    expect(days).toEqual(["2026-11-02", "2026-11-04", "2026-11-06"]);
    expect(days.every((d) => [1, 3, 5].includes(weekday(d)))).toBe(true);
  });
});

describe("gerador de plano", () => {
  const tasks = generatePlan(base);

  it("só agenda tarefas em dias permitidos, antes da prova", () => {
    expect(tasks.length).toBeGreaterThan(0);
    for (const task of tasks) {
      expect(base.weekdays).toContain(weekday(task.date));
      expect(task.date < base.examDate).toBe(true);
      expect(task.date >= base.startDate).toBe(true);
    }
  });

  it("respeita a meta diária de minutos", () => {
    const perDay = new Map<string, number>();
    for (const t of tasks) perDay.set(t.date, (perDay.get(t.date) ?? 0) + t.minutes);
    for (const minutes of perDay.values()) expect(minutes).toBeLessThanOrEqual(base.dailyMinutes);
  });

  it("cobre todos os tópicos e cria revisões espaçadas", () => {
    const studied = new Set(tasks.filter((t) => t.type === "study").map((t) => t.topic));
    for (const topic of ["Funções", "Geometria", "Probabilidade", "Citologia", "Genética"]) expect(studied).toContain(topic);
    const funcoes = tasks.filter((t) => t.topic === "Funções");
    expect(funcoes.some((t) => t.type === "review")).toBe(true);
    const studyDay = funcoes.find((t) => t.type === "study")!.date;
    expect(funcoes.filter((t) => t.type === "review").every((t) => t.date > studyDay)).toBe(true);
  });

  it("termina com simulado na reta final", () => {
    const last = tasks[tasks.length - 1]!;
    expect(last.type).toBe("mock_exam");
    expect(tasks.filter((t) => t.type === "mock_exam").length).toBeGreaterThanOrEqual(2);
  });

  it("matéria difícil aparece mais vezes na fila", () => {
    const queue = interleaveTopics([
      { subjectId: "a", name: "A", topics: ["a1", "a2", "a3", "a4"], weight: 3 },
      { subjectId: "b", name: "B", topics: ["b1", "b2", "b3", "b4"], weight: 1 },
    ]);
    const firstSix = queue.slice(0, 6).map((t) => t.subjectId);
    expect(firstSix.filter((s) => s === "a").length).toBeGreaterThan(firstSix.filter((s) => s === "b").length);
  });

  it("retorna vazio sem dias disponíveis", () => {
    expect(generatePlan({ ...base, startDate: "2026-12-14" })).toEqual([]);
    expect(generatePlan({ ...base, subjects: [] })).toEqual([]);
  });
});

describe("adaptação de atrasos", () => {
  it("move tarefas atrasadas para os próximos dias com folga e pula o que não cabe", () => {
    const result = adaptPlan({
      today: "2026-11-10",
      examDate: "2026-11-13",
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      dailyMinutes: 60,
      tasks: [
        { id: "atrasada-alta", date: "2026-11-08", minutes: 30, priority: 1, status: "pending" },
        { id: "atrasada-baixa", date: "2026-11-09", minutes: 60, priority: 3, status: "pending" },
        { id: "feita", date: "2026-11-08", minutes: 30, priority: 1, status: "done" },
        { id: "hoje", date: "2026-11-10", minutes: 50, priority: 2, status: "pending" },
        { id: "amanha", date: "2026-11-11", minutes: 60, priority: 2, status: "pending" },
        { id: "depois", date: "2026-11-12", minutes: 40, priority: 2, status: "pending" },
      ],
    });
    expect(result.moves).toEqual([{ id: "atrasada-alta", date: "2026-11-12" }]);
    expect(result.skips).toEqual(["atrasada-baixa"]);
  });

  it("encontra o próximo dia de estudo antes da prova", () => {
    expect(nextStudyDay("2026-11-06", [1, 3], "2026-11-20")).toBe("2026-11-09");
    expect(nextStudyDay("2026-11-18", [1], "2026-11-20")).toBeNull();
  });
});
