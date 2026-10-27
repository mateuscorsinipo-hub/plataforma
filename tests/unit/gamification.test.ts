import { describe, expect, it } from "vitest";

import { effectiveStreak, levelForXp, levelProgress, quizXp, xpForLevel } from "@/lib/domain/gamification";

describe("níveis e XP", () => {
  it("segue a mesma curva da função SQL level_for_xp", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(49)).toBe(1);
    expect(levelForXp(50)).toBe(2);
    expect(levelForXp(199)).toBe(2);
    expect(levelForXp(200)).toBe(3);
    expect(levelForXp(4050)).toBe(10);
    expect(xpForLevel(10)).toBe(4050);
  });

  it("calcula o progresso até o próximo nível", () => {
    expect(levelProgress(125)).toEqual({ level: 2, currentLevelXp: 50, nextLevelXp: 200, percent: 50 });
    expect(levelProgress(0).percent).toBe(0);
  });

  it("nunca dá XP negativo nem acima do total de questões", () => {
    expect(quizXp("quiz", 0, 0)).toBe(0);
    expect(quizXp("quiz", 7, 10)).toBe(10 + 14);
    expect(quizXp("quiz", 99, 10)).toBe(10 + 20);
    expect(quizXp("mock_exam", 30, 45)).toBe(30 + 60);
  });
});

describe("sequência de dias", () => {
  it("mantém a sequência se o último dia ativo foi hoje ou ontem", () => {
    expect(effectiveStreak(5, "2026-10-27", "2026-10-27")).toBe(5);
    expect(effectiveStreak(5, "2026-10-26", "2026-10-27")).toBe(5);
  });

  it("zera a sequência quando um dia passou sem estudo", () => {
    expect(effectiveStreak(5, "2026-10-25", "2026-10-27")).toBe(0);
    expect(effectiveStreak(5, null, "2026-10-27")).toBe(0);
  });
});
