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
