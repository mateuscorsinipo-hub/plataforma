import { Rating } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import { parseCardImport } from "@/lib/domain/card-import";
import { formatInterval, previewIntervals, scheduleReview, type SrsFields } from "@/lib/domain/srs";

const fresh = (now: Date): SrsFields => ({
  state: "new",
  due_at: now.toISOString(),
  stability: 0,
  difficulty: 0,
  elapsed_days: 0,
  scheduled_days: 0,
  learning_steps: 0,
  reps: 0,
  lapses: 0,
  last_review_at: null,
});

describe("repetição espaçada (FSRS)", () => {
  const now = new Date("2026-10-27T12:00:00Z");

  it("cartão novo: 'Errei' volta em minutos e 'Fácil' vai para dias depois", () => {
    const again = scheduleReview(fresh(now), Rating.Again, now);
    const easy = scheduleReview(fresh(now), Rating.Easy, now);
    expect(again.state).toBe("learning");
    expect(new Date(again.due_at).getTime() - now.getTime()).toBeLessThan(15 * 60_000);
    expect(easy.state).toBe("review");
    expect(new Date(easy.due_at).getTime() - now.getTime()).toBeGreaterThan(24 * 3600_000);
    expect(easy.reps).toBe(1);
  });

  it("intervalos crescem com acertos seguidos e um erro conta lapso", () => {
    let card = fresh(now);
    let at = now;
    const intervals: number[] = [];
    for (let i = 0; i < 4; i++) {
      const next = scheduleReview(card, Rating.Good, at);
      intervals.push(new Date(next.due_at).getTime() - at.getTime());
      card = { ...next, last_review_at: at.toISOString() };
      at = new Date(next.due_at);
    }
    expect(intervals[3]).toBeGreaterThan(intervals[1]!);
    const lapse = scheduleReview(card, Rating.Again, at);
    expect(lapse.lapses).toBe(1);
    expect(lapse.state).toBe("relearning");
  });

  it("a prévia dos botões é a mesma usada na gravação", () => {
    const card = fresh(now);
    const preview = previewIntervals(card, now);
    const good = scheduleReview(card, Rating.Good, now);
    expect(preview[Rating.Good]).toBe(formatInterval(now, new Date(good.due_at)));
  });

  it("formata intervalos em português", () => {
    const base = new Date("2026-01-01T00:00:00Z");
    expect(formatInterval(base, new Date(base.getTime() + 60_000))).toBe("1 min");
    expect(formatInterval(base, new Date(base.getTime() + 86_400_000))).toBe("1 dia");
    expect(formatInterval(base, new Date(base.getTime() + 5 * 86_400_000))).toBe("5 dias");
    expect(formatInterval(base, new Date(base.getTime() + 90 * 86_400_000))).toBe("3 meses");
  });
});

describe("importação de cartões", () => {
  it("aceita tabulação, ponto e vírgula e hífen, e informa linhas ignoradas", () => {
    const tab = parseCardImport("Capital da França\tParis\nH2O\tÁgua");
    expect(tab.cards).toEqual([
      { front: "Capital da França", back: "Paris" },
      { front: "H2O", back: "Água" },
    ]);
    const mixed = parseCardImport("a;b\nlinha sem separador\nc;d");
    expect(mixed.cards).toHaveLength(2);
    expect(mixed.skipped).toEqual([2]);
  });

  it("usa o separador predominante para não quebrar textos com dois-pontos", () => {
    const result = parseCardImport("Fórmula: Bhaskara;x = (-b ± √Δ)/2a\nRazão: seno;cateto oposto/hipotenusa");
    expect(result.cards[0]).toEqual({ front: "Fórmula: Bhaskara", back: "x = (-b ± √Δ)/2a" });
  });

  it("respeita o limite de cartões", () => {
    const text = Array.from({ length: 10 }, (_, i) => `f${i};v${i}`).join("\n");
    expect(parseCardImport(text, 3).cards).toHaveLength(3);
  });
});
