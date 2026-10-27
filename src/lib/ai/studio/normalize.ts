import type { GenerationContent, NormalizedQuestion } from "@/lib/ai/studio/content";
import type { GenerationKind } from "@/lib/ai/studio/kinds";
import type { RawOutput, RawQuestion } from "@/lib/ai/studio/schemas";

/**
 * Conferência semântica do que o modelo devolveu. O esquema garante o formato;
 * aqui garantimos o conteúdo: alternativas válidas, um gabarito por questão,
 * nada vazio ou duplicado e a quantidade pedida.
 */
const OPTION_IDS = ["a", "b", "c", "d", "e", "f"] as const;

function clean(value: string, max: number): string {
  return value.replace(/\u0000/g, "").trim().slice(0, max);
}

/** Remove "A) ", "a. ", "(c) " do começo de alternativas. */
export function stripOptionLabel(value: string): string {
  return value.replace(/^\s*(?:\(?[a-fA-F]\)|[a-fA-F][.)-])\s+/, "").trim();
}

function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item).toLowerCase().replace(/\s+/g, " ").trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function normalizeQuestion(raw: RawQuestion): NormalizedQuestion | null {
  const prompt = clean(raw.prompt, 5_000);
  const explanation = clean(raw.explanation, 5_000);
  const topic = clean(raw.topic, 120) || "Geral";
  const difficulty = raw.difficulty;
  if (!prompt) return null;

  if (raw.type === "multiple_choice") {
    const texts = raw.options.map((option) => clean(stripOptionLabel(option), 2_000)).filter(Boolean);
    const unique = new Set(texts.map((t) => t.toLowerCase()));
    if (texts.length < 2 || texts.length > 6 || unique.size !== texts.length) return null;
    if (!Number.isInteger(raw.correctOption) || raw.correctOption < 0 || raw.correctOption >= texts.length) return null;
    const options = texts.map((text, index) => ({ id: OPTION_IDS[index]!, text }));
    return {
      type: "multiple_choice",
      prompt,
      options,
      correctOptionId: options[raw.correctOption]!.id,
      referenceAnswer: null,
      explanation,
      difficulty,
      topic,
    };
  }

  if (raw.type === "true_false") {
    if (typeof raw.correctBoolean !== "boolean") return null;
    return {
      type: "true_false",
      prompt,
      options: [
        { id: "true", text: "Verdadeiro" },
        { id: "false", text: "Falso" },
      ],
      correctOptionId: raw.correctBoolean ? "true" : "false",
      referenceAnswer: null,
      explanation,
      difficulty,
      topic,
    };
  }

  const referenceAnswer = clean(raw.expectedAnswer, 5_000);
  if (!referenceAnswer) return null;
  return { type: "open", prompt, options: [], correctOptionId: null, referenceAnswer, explanation, difficulty, topic };
}

export function normalizeQuestions(raw: RawQuestion[], count: number, allowOpen: boolean): NormalizedQuestion[] {
  const normalized = raw.flatMap((question) => {
    const result = normalizeQuestion(question);
    if (!result || (!allowOpen && result.type === "open")) return [];
    return [result];
  });
  return dedupeBy(normalized, (q) => q.prompt).slice(0, count);
}

export class EmptyGenerationError extends Error {
  constructor() {
    super("empty_generation");
    this.name = "EmptyGenerationError";
  }
}

function requireItems<T>(items: T[]): T[] {
  if (!items.length) throw new EmptyGenerationError();
  return items;
}

export type NormalizeOptions = { count: number; title: string; allowOpen: boolean; durationMinutes?: number };

export function normalizeOutput(kind: GenerationKind, raw: unknown, options: NormalizeOptions): GenerationContent {
  const title = (fallback: string) => clean(options.title || fallback, 160) || "Material de estudo";

  switch (kind) {
    case "summary_quick":
    case "summary_detailed": {
      const out = raw as RawOutput<"summary_quick">;
      const sections = requireItems(
        out.sections
          .map((s) => ({ heading: clean(s.heading, 300), body: clean(s.body, 40_000) }))
          .filter((s) => s.body)
          .slice(0, 60),
      );
      return {
        kind,
        title: title(out.title),
        overview: clean(out.overview, 4_000),
        sections,
        keyPoints: out.keyPoints.map((p) => clean(p, 1_000)).filter(Boolean).slice(0, 40),
      };
    }
    case "study_guide": {
      const out = raw as RawOutput<"study_guide">;
      return {
        kind,
        title: title(out.title),
        objectives: out.objectives.map((o) => clean(o, 1_000)).filter(Boolean).slice(0, 30),
        sections: requireItems(
          out.sections
            .map((s) => ({
              heading: clean(s.heading, 300),
              body: clean(s.body, 40_000),
              checkQuestions: s.checkQuestions.map((q) => clean(q, 1_000)).filter(Boolean).slice(0, 10),
            }))
            .filter((s) => s.body)
            .slice(0, 40),
        ),
        tips: out.tips.map((t) => clean(t, 1_000)).filter(Boolean).slice(0, 20),
      };
    }
    case "key_concepts": {
      const out = raw as RawOutput<"key_concepts">;
      const concepts = dedupeBy(
        out.concepts
          .map((c) => ({ term: clean(c.term, 200), explanation: clean(c.explanation, 4_000), example: clean(c.example, 2_000) }))
          .filter((c) => c.term && c.explanation),
        (c) => c.term,
      );
      return { kind, title: title(out.title), concepts: requireItems(concepts.slice(0, options.count)) };
    }
    case "glossary": {
      const out = raw as RawOutput<"glossary">;
      const terms = dedupeBy(
        out.terms.map((t) => ({ term: clean(t.term, 200), definition: clean(t.definition, 2_000) })).filter((t) => t.term && t.definition),
        (t) => t.term,
      ).sort((a, b) => a.term.localeCompare(b.term, "pt-BR"));
      return { kind, title: title(out.title), terms: requireItems(terms.slice(0, options.count)) };
    }
    case "flashcards": {
      const out = raw as RawOutput<"flashcards">;
      const cards = dedupeBy(
        out.cards
          .map((c) => ({ front: clean(c.front, 2_000), back: clean(c.back, 4_000), hint: clean(c.hint, 500) }))
          .filter((c) => c.front && c.back),
        (c) => c.front,
      );
      return { kind, title: title(out.title), cards: requireItems(cards.slice(0, options.count)) };
    }
    case "quiz": {
      const out = raw as RawOutput<"quiz">;
      return {
        kind,
        title: title(out.title),
        questions: requireItems(normalizeQuestions(out.questions, options.count, options.allowOpen)),
      };
    }
    case "mock_exam": {
      const out = raw as RawOutput<"mock_exam">;
      const duration = options.durationMinutes ?? out.durationMinutes;
      return {
        kind,
        title: title(out.title),
        durationMinutes: Math.min(600, Math.max(5, Math.round(Number.isFinite(duration) ? duration : 60))),
        instructions: clean(out.instructions, 2_000),
        questions: requireItems(normalizeQuestions(out.questions, options.count, options.allowOpen)),
      };
    }
    case "essay_questions": {
      const out = raw as RawOutput<"essay_questions">;
      const questions = dedupeBy(
        out.questions
          .map((q) => ({
            prompt: clean(q.prompt, 5_000),
            expectedPoints: q.expectedPoints.map((p) => clean(p, 1_000)).filter(Boolean).slice(0, 12),
            modelAnswer: clean(q.modelAnswer, 8_000),
          }))
          .filter((q) => q.prompt && q.modelAnswer),
        (q) => q.prompt,
      );
      return { kind, title: title(out.title), questions: requireItems(questions.slice(0, options.count)) };
    }
    case "explanation": {
      const out = raw as RawOutput<"explanation">;
      const explanation = clean(out.explanation, 40_000);
      if (!explanation) throw new EmptyGenerationError();
      return {
        kind,
        title: title(out.title),
        explanation,
        examples: out.examples.map((e) => clean(e, 4_000)).filter(Boolean).slice(0, 12),
        commonMistakes: out.commonMistakes.map((m) => clean(m, 2_000)).filter(Boolean).slice(0, 12),
        practice: out.practice
          .map((p) => ({ question: clean(p.question, 2_000), answer: clean(p.answer, 4_000) }))
          .filter((p) => p.question && p.answer)
          .slice(0, 12),
      };
    }
  }
}
