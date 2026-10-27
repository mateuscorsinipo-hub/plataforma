/** Pares de cor (fundo/texto) para matérias. Contraste do texto ≥ 4,5:1 sobre o fundo. */
export const subjectColorClasses = {
  blue: "bg-[#EEF3FF] text-[#1D45C4]",
  rose: "bg-[#FCEEF4] text-[#A1305F]",
  purple: "bg-[#F3EEFB] text-[#6B3FA0]",
  green: "bg-[#E7F6EE] text-[#17704A]",
  teal: "bg-[#E4F5F6] text-[#0B6770]",
  indigo: "bg-[#F0EEFF] text-[#4B3BC2]",
  amber: "bg-[#FBF1E6] text-[#8A4A0B]",
  lime: "bg-[#EDF6E8] text-[#356B1E]",
  orange: "bg-[#FFF1E8] text-[#9A3F0C]",
  sky: "bg-[#E8F4FB] text-[#155E8A]",
  slate: "bg-[#EEF0F5] text-[#3A4664]",
  yellow: "bg-[#FFF6D6] text-[#6E5300]",
} as const;

export type SubjectColor = keyof typeof subjectColorClasses;

export function subjectColorClass(color: string | null | undefined): string {
  return subjectColorClasses[(color ?? "slate") as SubjectColor] ?? subjectColorClasses.slate;
}

export const schoolStageLabels = {
  fundamental_1: "Ensino Fundamental I",
  fundamental_2: "Ensino Fundamental II",
  medio: "Ensino Médio",
  pre_vestibular: "Pré-vestibular",
  superior: "Ensino Superior",
  outro: "Outro",
} as const;

export type SchoolStage = keyof typeof schoolStageLabels;

export const gradeOptions: Record<SchoolStage, { value: number; label: string }[]> = {
  fundamental_1: [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n}º ano` })),
  fundamental_2: [6, 7, 8, 9].map((n) => ({ value: n, label: `${n}º ano` })),
  medio: [1, 2, 3].map((n) => ({ value: n, label: `${n}ª série` })),
  pre_vestibular: [],
  superior: [],
  outro: [],
};

export function gradeLabel(stage: string | null | undefined, grade: number | null | undefined): string | null {
  if (!stage) return null;
  const stageLabel = schoolStageLabels[stage as SchoolStage];
  if (!stageLabel) return null;
  if (!grade) return stageLabel;
  if (stage === "medio") return `${grade}ª série do EM`;
  if (stage === "fundamental_1" || stage === "fundamental_2") return `${grade}º ano do EF`;
  return stageLabel;
}

export const materialTypeLabels = {
  summary: "Resumo",
  mind_map: "Mapa mental",
  exercise_list: "Lista de exercícios",
  notes: "Anotações",
  presentation: "Apresentação",
  flashcards: "Flashcards",
  essay: "Redação",
  other: "Outro",
} as const;

export type MaterialType = keyof typeof materialTypeLabels;
