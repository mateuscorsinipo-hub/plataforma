import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type QuizKind = "quiz" | "mock_exam";
type QuestionRow = Database["public"]["Tables"]["quiz_questions"]["Row"];

export type QuestionOption = { id: string; text: string };

export function parseOptions(value: unknown): QuestionOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const { id, text } = item as Record<string, unknown>;
    return typeof id === "string" && typeof text === "string" ? [{ id, text }] : [];
  });
}

export type QuizListItem = {
  id: string;
  title: string;
  kind: QuizKind;
  subjectId: string | null;
  questionsCount: number;
  durationMinutes: number | null;
  updatedAt: string;
  lastAttempt: { id: string; status: string; score: number | null; maxScore: number | null; correct: number | null; total: number | null; startedAt: string } | null;
};

export async function listQuizzes(kind: QuizKind): Promise<QuizListItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("id, title, kind, subject_id, questions_count, duration_minutes, updated_at")
    .eq("kind", kind)
    .order("updated_at", { ascending: false })
    .limit(200);
  const ids = (quizzes ?? []).map((q) => q.id);
  const { data: attempts } = ids.length
    ? await supabase
        .from("quiz_attempts")
        .select("id, quiz_id, status, score, max_score, correct_count, total_count, started_at")
        .in("quiz_id", ids)
        .order("started_at", { ascending: false })
        .limit(1000)
    : { data: [] };
  const latest = new Map<string, NonNullable<typeof attempts>[number]>();
  for (const attempt of attempts ?? []) if (!latest.has(attempt.quiz_id)) latest.set(attempt.quiz_id, attempt);
  return (quizzes ?? []).map((q) => {
    const a = latest.get(q.id);
    return {
      id: q.id,
      title: q.title,
      kind: q.kind,
      subjectId: q.subject_id,
      questionsCount: q.questions_count,
      durationMinutes: q.duration_minutes,
      updatedAt: q.updated_at,
      lastAttempt: a
        ? {
            id: a.id,
            status: a.status,
            score: a.score === null ? null : Number(a.score),
            maxScore: a.max_score === null ? null : Number(a.max_score),
            correct: a.correct_count,
            total: a.total_count,
            startedAt: a.started_at,
          }
        : null,
    };
  });
}

export type QuestionView = Omit<QuestionRow, "options"> & { options: QuestionOption[] };

export async function getQuizWithQuestions(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data: quiz } = await supabase.from("quizzes").select("*").eq("id", id).maybeSingle();
  if (!quiz) return null;
  const { data: questions } = await supabase.from("quiz_questions").select("*").eq("quiz_id", id).order("position").limit(300);
  return {
    quiz,
    questions: (questions ?? []).map((q) => ({ ...q, options: parseOptions(q.options) })) as QuestionView[],
  };
}

export async function getQuizHistory(quizId: string) {
  const supabase = await createSupabaseServerClient();
  const [{ data: attempts }, { data: recurring }] = await Promise.all([
    supabase
      .from("quiz_attempts")
      .select("id, status, score, max_score, correct_count, total_count, started_at, submitted_at, duration_seconds")
      .eq("quiz_id", quizId)
      .order("started_at", { ascending: false })
      .limit(20),
    supabase.rpc("quiz_recurring_errors", { p_quiz_id: quizId }),
  ]);
  return { attempts: attempts ?? [], recurring: recurring ?? [] };
}

export async function getAttempt(attemptId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: attempt } = await supabase.from("quiz_attempts").select("*").eq("id", attemptId).maybeSingle();
  if (!attempt) return null;
  const [quizData, { data: answers }] = await Promise.all([
    getQuizWithQuestions(attempt.quiz_id),
    supabase.from("quiz_answers").select("*").eq("attempt_id", attemptId),
  ]);
  if (!quizData) return null;
  return { attempt, quiz: quizData.quiz, questions: quizData.questions, answers: answers ?? [] };
}
