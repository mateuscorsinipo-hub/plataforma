/** Recomendação de materiais da biblioteca: regras simples, explicáveis e testáveis. */

export type RecommendationCandidate = {
  id: string;
  subjectId: string;
  topic: string | null;
  tags: string[];
  schoolStage: string | null;
  gradeYear: number | null;
  saves: number;
  ratingAverage: number | null;
  ratingCount: number;
};

export type RecommendationReason =
  | { kind: "weak_topic"; topic: string }
  | { kind: "same_grade" }
  | { kind: "same_stage" }
  | { kind: "well_rated" }
  | { kind: "popular" };

export type RecommendationContext = {
  weakTopics: { subjectId: string | null; topic: string }[];
  schoolStage: string | null;
  gradeYear: number | null;
  excludeIds: Set<string>;
};

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function matchesTopic(candidate: RecommendationCandidate, weak: { subjectId: string | null; topic: string }): boolean {
  if (weak.subjectId && weak.subjectId !== candidate.subjectId) return false;
  const target = normalizeText(weak.topic);
  if (target.length < 3) return false;
  const fields = [candidate.topic ?? "", ...candidate.tags].map(normalizeText).filter((f) => f.length >= 3);
  return fields.some((f) => f.includes(target) || target.includes(f));
}

/**
 * Ordena por: tema em que o estudante erra mais > mesma série > mesma etapa > bem
 * avaliado (média ≥ 4 com 3+ avaliações) > popularidade. Já salvos ficam de fora.
 */
export function rankRecommendations<T extends RecommendationCandidate>(
  candidates: T[],
  ctx: RecommendationContext,
  limit = 3,
): { item: T; reason: RecommendationReason }[] {
  const scored = candidates
    .filter((c) => !ctx.excludeIds.has(c.id))
    .map((item) => {
      const weak = ctx.weakTopics.find((w) => matchesTopic(item, w));
      const sameStage = Boolean(ctx.schoolStage && item.schoolStage === ctx.schoolStage);
      const sameGrade = sameStage && ctx.gradeYear !== null && item.gradeYear === ctx.gradeYear;
      const wellRated = item.ratingAverage !== null && item.ratingAverage >= 4 && item.ratingCount >= 3;
      const score = (weak ? 100 : 0) + (sameGrade ? 20 : 0) + (sameStage ? 10 : 0) + (wellRated ? 5 : 0);
      const reason: RecommendationReason = weak
        ? { kind: "weak_topic", topic: weak.topic }
        : sameGrade
          ? { kind: "same_grade" }
          : sameStage
            ? { kind: "same_stage" }
            : wellRated
              ? { kind: "well_rated" }
              : { kind: "popular" };
      return { item, reason, score };
    });
  scored.sort((a, b) => b.score - a.score || b.item.saves - a.item.saves);
  return scored.slice(0, limit).map(({ item, reason }) => ({ item, reason }));
}

export function reasonLabel(reason: RecommendationReason): string {
  switch (reason.kind) {
    case "weak_topic":
      return `Para reforçar ${reason.topic}`;
    case "same_grade":
      return "Da sua série";
    case "same_stage":
      return "Da sua etapa";
    case "well_rated":
      return "Bem avaliado";
    default:
      return "Popular na biblioteca";
  }
}
