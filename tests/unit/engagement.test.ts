import { describe, expect, it } from "vitest";

import { challengePool, challengeProgress, challengeSourceId, challengesForWeek } from "@/lib/domain/challenges";
import { addDays } from "@/lib/domain/dates";
import { normalizeText, rankRecommendations, reasonLabel, type RecommendationCandidate } from "@/lib/domain/recommendations";

describe("desafios da semana", () => {
  it("escolhe três desafios diferentes, iguais para todos na mesma semana", () => {
    const week = challengesForWeek("2026-10-26", { dailyGoalMinutes: 30 });
    expect(week).toHaveLength(3);
    expect(new Set(week.map((c) => c.code)).size).toBe(3);
    expect(challengesForWeek("2026-10-26", { dailyGoalMinutes: 30 })).toEqual(week);
  });

  it("faz rodízio: em sete semanas todo desafio do banco aparece", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 7; i++) {
      for (const c of challengesForWeek(addDays("2026-10-26", i * 7), { dailyGoalMinutes: 30 })) seen.add(c.code);
    }
    expect(seen.size).toBe(challengePool.length);
  });

  it("ajusta a meta de minutos à meta diária, com limites", () => {
    const minutes = (goal: number) => challengePool.find((t) => t.code === "minutos")!.target({ dailyGoalMinutes: goal });
    expect(minutes(30)).toBe(120);
    expect(minutes(37)).toBe(150);
    expect(minutes(5)).toBe(60);
    expect(minutes(300)).toBe(600);
  });

  it("calcula o progresso sem passar de 100%", () => {
    const [challenge] = challengesForWeek("2026-10-26", { dailyGoalMinutes: 30 });
    const full = Object.fromEntries(challengePool.map((t) => [t.metric, 10_000])) as Parameters<typeof challengeProgress>[1];
    expect(challengeProgress(challenge!, full)).toMatchObject({ percent: 100, done: true });
    const none = Object.fromEntries(challengePool.map((t) => [t.metric, 0])) as Parameters<typeof challengeProgress>[1];
    expect(challengeProgress(challenge!, none)).toMatchObject({ value: 0, percent: 0, done: false });
  });

  it("identifica o resgate por semana e desafio", () => {
    expect(challengeSourceId("2026-10-26", "foco")).toBe("2026-10-26:foco");
  });
});

describe("recomendações", () => {
  const base: RecommendationCandidate = {
    id: "",
    subjectId: "mat",
    topic: null,
    tags: [],
    schoolStage: null,
    gradeYear: null,
    saves: 0,
    ratingAverage: null,
    ratingCount: 0,
  };
  const items = [
    { ...base, id: "popular", saves: 90 },
    { ...base, id: "etapa", schoolStage: "medio", saves: 5 },
    { ...base, id: "serie", schoolStage: "medio", gradeYear: 2, saves: 1 },
    { ...base, id: "tema", topic: "Funções do 1º grau", saves: 0 },
    { ...base, id: "salvo", topic: "Funções", saves: 100 },
    { ...base, id: "outra-materia", subjectId: "bio", tags: ["funcoes"], saves: 50 },
  ];
  const ctx = {
    weakTopics: [{ subjectId: "mat", topic: "funcoes" }],
    schoolStage: "medio",
    gradeYear: 2,
    excludeIds: new Set(["salvo"]),
  };

  it("prioriza o tema com mais erros (sem acento) e depois série e etapa", () => {
    const ranked = rankRecommendations(items, ctx, 4);
    expect(ranked.map((r) => r.item.id)).toEqual(["tema", "serie", "etapa", "popular"]);
    expect(reasonLabel(ranked[0]!.reason)).toBe("Para reforçar funcoes");
    expect(ranked[1]!.reason).toEqual({ kind: "same_grade" });
  });

  it("não recomenda o que já foi salvo nem casa tema de outra matéria", () => {
    const ids = rankRecommendations(items, ctx, 10).map((r) => r.item.id);
    expect(ids).not.toContain("salvo");
    const outra = rankRecommendations(items, ctx, 10).find((r) => r.item.id === "outra-materia");
    expect(outra?.reason.kind).toBe("popular");
  });

  it("destaca materiais bem avaliados só com avaliações suficientes", () => {
    const ranked = rankRecommendations(
      [
        { ...base, id: "uma-nota", ratingAverage: 5, ratingCount: 1, saves: 10 },
        { ...base, id: "varias-notas", ratingAverage: 4.5, ratingCount: 4, saves: 0 },
      ],
      { weakTopics: [], schoolStage: null, gradeYear: null, excludeIds: new Set() },
    );
    expect(ranked.map((r) => r.item.id)).toEqual(["varias-notas", "uma-nota"]);
    expect(reasonLabel(ranked[0]!.reason)).toBe("Bem avaliado");
  });

  it("normaliza acentos e espaços", () => {
    expect(normalizeText("  Função   Afim ")).toBe("funcao afim");
  });
});
