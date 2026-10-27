/**
 * Ferramentas do estúdio. Metadados compartilhados entre a interface e o servidor;
 * os limites de quantidade por plano vêm de `plans.ts`.
 */
export type GenerationKind =
  | "summary_quick"
  | "summary_detailed"
  | "study_guide"
  | "key_concepts"
  | "glossary"
  | "flashcards"
  | "quiz"
  | "mock_exam"
  | "essay_questions"
  | "explanation";

export type GenerationDifficulty = "easy" | "medium" | "hard";
export type GenerationLength = "short" | "medium" | "long";

export type KindDefinition = {
  kind: GenerationKind;
  label: string;
  description: string;
  /** Tipo de saída: texto (editável em Markdown) ou itens estruturados. */
  output: "document" | "flashcards" | "questions";
  usesDifficulty: boolean;
  usesLength: boolean;
  count: { min: number; default: number; label: string } | null;
};

export const generationKinds: KindDefinition[] = [
  {
    kind: "summary_quick",
    label: "Resumo rápido",
    description: "Os pontos essenciais em poucos minutos de leitura.",
    output: "document",
    usesDifficulty: false,
    usesLength: false,
    count: null,
  },
  {
    kind: "summary_detailed",
    label: "Resumo detalhado",
    description: "Conteúdo completo, organizado por seções.",
    output: "document",
    usesDifficulty: false,
    usesLength: true,
    count: null,
  },
  {
    kind: "study_guide",
    label: "Guia de estudo",
    description: "Objetivos, roteiro por tópicos e perguntas de checagem.",
    output: "document",
    usesDifficulty: false,
    usesLength: true,
    count: null,
  },
  {
    kind: "key_concepts",
    label: "Conceitos-chave",
    description: "Os conceitos mais importantes, explicados com exemplos.",
    output: "document",
    usesDifficulty: false,
    usesLength: false,
    count: { min: 3, default: 10, label: "Conceitos" },
  },
  {
    kind: "glossary",
    label: "Glossário",
    description: "Termos técnicos com definições claras.",
    output: "document",
    usesDifficulty: false,
    usesLength: false,
    count: { min: 5, default: 20, label: "Termos" },
  },
  {
    kind: "flashcards",
    label: "Flashcards",
    description: "Cartões de pergunta e resposta para revisão espaçada.",
    output: "flashcards",
    usesDifficulty: true,
    usesLength: false,
    count: { min: 5, default: 20, label: "Cartões" },
  },
  {
    kind: "quiz",
    label: "Quiz",
    description: "Múltipla escolha, verdadeiro ou falso e abertas, com gabarito comentado.",
    output: "questions",
    usesDifficulty: true,
    usesLength: false,
    count: { min: 3, default: 10, label: "Questões" },
  },
  {
    kind: "mock_exam",
    label: "Simulado",
    description: "Prova cronometrada no estilo ENEM, vestibular ou escola.",
    output: "questions",
    usesDifficulty: true,
    usesLength: false,
    count: { min: 5, default: 20, label: "Questões" },
  },
  {
    kind: "essay_questions",
    label: "Questões dissertativas",
    description: "Perguntas abertas com pontos esperados e resposta modelo.",
    output: "document",
    usesDifficulty: true,
    usesLength: false,
    count: { min: 2, default: 5, label: "Questões" },
  },
  {
    kind: "explanation",
    label: "Explicação passo a passo",
    description: "O conteúdo explicado do zero, com exemplos e erros comuns.",
    output: "document",
    usesDifficulty: true,
    usesLength: true,
    count: null,
  },
];

export const kindByName: Record<GenerationKind, KindDefinition> = Object.fromEntries(
  generationKinds.map((definition) => [definition.kind, definition]),
) as Record<GenerationKind, KindDefinition>;

export const difficultyLabels: Record<GenerationDifficulty, string> = { easy: "Fácil", medium: "Média", hard: "Difícil" };
export const lengthLabels: Record<GenerationLength, string> = { short: "Curto", medium: "Médio", long: "Longo" };

export type ExamStyle = "enem" | "vestibular" | "school";
export const examStyleLabels: Record<ExamStyle, string> = { enem: "ENEM", vestibular: "Vestibular", school: "Prova da escola" };

/** Quantidade máxima por tipo, conforme o plano. */
export function maxCountFor(
  kind: GenerationKind,
  plan: { maxQuestionsPerQuiz: number; maxMockExamQuestions: number; maxFlashcardsPerGeneration: number },
): number {
  switch (kind) {
    case "flashcards":
      return plan.maxFlashcardsPerGeneration;
    case "quiz":
      return plan.maxQuestionsPerQuiz;
    case "mock_exam":
      return plan.maxMockExamQuestions;
    case "essay_questions":
      return 15;
    case "key_concepts":
      return 30;
    case "glossary":
      return 60;
    default:
      return 0;
  }
}
