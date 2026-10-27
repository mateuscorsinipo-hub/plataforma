"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { aiAvailability } from "@/lib/ai";
import { gradeOpenAnswer } from "@/lib/ai/grading";
import { parseStoredContent } from "@/lib/ai/studio/content";
import { requireUser } from "@/lib/auth/session";
import { annotateUsage, consumeFeature, getPlanForUser, getUserTimezone, refundUsage } from "@/lib/billing/entitlements";
import { quizXp, XP_RULES } from "@/lib/domain/gamification";
import { logger } from "@/lib/logger";
import { achievementTitles, recordProgress } from "@/lib/progress/record";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fieldErrorsOf, formDataToObject, uuidSchema, type ActionState } from "@/lib/validation/common";
import { questionInputSchema, questionToRow, quizSchema } from "@/lib/validation/quizzes";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const listPath = (kind: string) => (kind === "mock_exam" ? "/app/simulados" : "/app/quizzes");

// Criação e edição -----------------------------------------------------------------------

export async function createQuiz(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/app/quizzes");
  const parsed = quizSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: "Revise os campos.", fieldErrors: fieldErrorsOf(parsed.error) };
  const input = parsed.data;
  if (input.kind === "mock_exam" && !input.durationMinutes) return { error: "Defina a duração do simulado.", fieldErrors: { durationMinutes: ["Informe a duração."] } };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("quizzes")
    .insert({
      user_id: user.id,
      kind: input.kind,
      title: input.title,
      description: input.description,
      subject_id: input.subjectId,
      duration_minutes: input.kind === "mock_exam" ? (input.durationMinutes ?? 60) : null,
      exam_type: input.kind === "mock_exam" ? "custom" : null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Não foi possível criar." };
  redirect(`/app/quizzes/${data.id}/editar`);
}

export async function updateQuizSettings(
  quizId: string,
  input: { title: string; description: string; subjectId: string; durationMinutes?: number | null },
): Promise<Result> {
  await requireUser("/app/quizzes");
  const id = uuidSchema.safeParse(quizId);
  const parsed = quizSchema.safeParse({ ...input, durationMinutes: input.durationMinutes ?? undefined });
  if (!id.success) return { ok: false, error: "Quiz inválido." };
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const supabase = await createSupabaseServerClient();
  const { data: quiz } = await supabase.from("quizzes").select("kind").eq("id", id.data).maybeSingle();
  if (!quiz) return { ok: false, error: "Quiz não encontrado." };
  const { error } = await supabase
    .from("quizzes")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      subject_id: parsed.data.subjectId,
      ...(quiz.kind === "mock_exam" ? { duration_minutes: parsed.data.durationMinutes ?? 60 } : {}),
    })
    .eq("id", id.data);
  if (error) return { ok: false, error: "Não foi possível salvar." };
  refresh();
  return { ok: true };
}

export async function deleteQuiz(quizId: string): Promise<Result> {
  await requireUser("/app/quizzes");
  const id = uuidSchema.safeParse(quizId);
  if (!id.success) return { ok: false, error: "Quiz inválido." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("quizzes").delete().eq("id", id.data).select("kind").maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível excluir." };
  redirect(`${listPath(data.kind)}?quiz-excluido=1`);
}

export async function saveQuestion(quizId: string, questionId: string | null, raw: unknown): Promise<Result<{ id: string }>> {
  const user = await requireUser("/app/quizzes");
  const id = uuidSchema.safeParse(quizId);
  if (!id.success) return { ok: false, error: "Quiz inválido." };
  const parsed = questionInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Questão inválida." };
  const supabase = await createSupabaseServerClient();
  const row = questionToRow(parsed.data);
  if (questionId) {
    const qid = uuidSchema.safeParse(questionId);
    if (!qid.success) return { ok: false, error: "Questão inválida." };
    const { data, error } = await supabase.from("quiz_questions").update(row).eq("id", qid.data).eq("quiz_id", id.data).select("id").maybeSingle();
    if (error || !data) return { ok: false, error: "Não foi possível salvar a questão." };
    refresh();
    return { ok: true, id: data.id };
  }
  const { data: last } = await supabase.from("quiz_questions").select("position").eq("quiz_id", id.data).order("position", { ascending: false }).limit(1);
  const { data: quiz } = await supabase.from("quizzes").select("questions_count").eq("id", id.data).maybeSingle();
  if (!quiz) return { ok: false, error: "Quiz não encontrado." };
  if (quiz.questions_count >= 150) return { ok: false, error: "Um quiz pode ter até 150 questões." };
  const { data, error } = await supabase
    .from("quiz_questions")
    .insert({ ...row, quiz_id: id.data, user_id: user.id, position: (last?.[0]?.position ?? -1) + 1 })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Não foi possível adicionar a questão." };
  refresh();
  return { ok: true, id: data.id };
}

export async function deleteQuestion(questionId: string): Promise<Result> {
  await requireUser("/app/quizzes");
  const id = uuidSchema.safeParse(questionId);
  if (!id.success) return { ok: false, error: "Questão inválida." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("quiz_questions").delete().eq("id", id.data).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível excluir a questão." };
  refresh();
  return { ok: true };
}

export async function moveQuestion(questionId: string, direction: "up" | "down"): Promise<Result> {
  await requireUser("/app/quizzes");
  const id = uuidSchema.safeParse(questionId);
  if (!id.success) return { ok: false, error: "Questão inválida." };
  const supabase = await createSupabaseServerClient();
  const { data: current } = await supabase.from("quiz_questions").select("id, quiz_id, position").eq("id", id.data).maybeSingle();
  if (!current) return { ok: false, error: "Questão não encontrada." };
  const { data: neighbors } = await supabase
    .from("quiz_questions")
    .select("id, position")
    .eq("quiz_id", current.quiz_id)
    .order("position", { ascending: direction === "down" })
    [direction === "up" ? "lt" : "gt"]("position", current.position)
    .limit(1);
  const other = neighbors?.[0];
  if (!other) return { ok: true };
  // Troca em três passos por causa do índice único (quiz_id, position).
  const temp = 100_000 + current.position;
  await supabase.from("quiz_questions").update({ position: temp }).eq("id", current.id);
  await supabase.from("quiz_questions").update({ position: current.position }).eq("id", other.id);
  await supabase.from("quiz_questions").update({ position: other.position }).eq("id", current.id);
  refresh();
  return { ok: true };
}

/** Transforma um quiz ou simulado gerado no estúdio em um quiz que dá para fazer e repetir. */
export async function saveGenerationAsQuiz(generationId: string): Promise<Result> {
  const user = await requireUser("/app/estudio");
  const id = uuidSchema.safeParse(generationId);
  if (!id.success) return { ok: false, error: "Material inválido." };
  const supabase = await createSupabaseServerClient();
  const { data: generation } = await supabase
    .from("ai_generations")
    .select("id, title, status, content, subject_id, folder_id, params")
    .eq("id", id.data)
    .maybeSingle();
  const content = parseStoredContent(generation?.content);
  if (!generation || generation.status !== "completed" || !content || (content.kind !== "quiz" && content.kind !== "mock_exam")) {
    return { ok: false, error: "Este material não é um quiz ou simulado pronto." };
  }
  const { data: existing } = await supabase.from("quizzes").select("id").eq("source_generation_id", generation.id).maybeSingle();
  if (existing) redirect(`/app/quizzes/${existing.id}`);

  const params = (generation.params ?? {}) as Record<string, unknown>;
  const examStyle = params.examStyle === "enem" || params.examStyle === "vestibular" ? params.examStyle : "school";
  const difficulty = params.difficulty === "easy" || params.difficulty === "hard" ? params.difficulty : "medium";
  const { data: quiz, error } = await supabase
    .from("quizzes")
    .insert({
      user_id: user.id,
      kind: content.kind,
      title: generation.title.slice(0, 160),
      description: content.kind === "mock_exam" ? content.instructions.slice(0, 1000) || null : null,
      subject_id: generation.subject_id,
      folder_id: generation.folder_id,
      difficulty,
      exam_type: content.kind === "mock_exam" ? examStyle : null,
      duration_minutes: content.kind === "mock_exam" ? content.durationMinutes : null,
      source_generation_id: generation.id,
    })
    .select("id")
    .single();
  if (error || !quiz) return { ok: false, error: "Não foi possível criar o quiz." };
  const { error: questionsError } = await supabase.from("quiz_questions").insert(
    content.questions.map((q, index) => ({
      quiz_id: quiz.id,
      user_id: user.id,
      position: index,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      correct_option_id: q.correctOptionId,
      reference_answer: q.referenceAnswer,
      explanation: q.explanation || null,
      topic: q.topic || null,
      subject_id: generation.subject_id,
    })),
  );
  if (questionsError) {
    await supabase.from("quizzes").delete().eq("id", quiz.id);
    logger.error("quizzes.save_generation_failed", { code: questionsError.code });
    return { ok: false, error: "Não foi possível salvar as questões." };
  }
  redirect(`/app/quizzes/${quiz.id}`);
}

const composeSchema = z.object({
  title: z.string().trim().min(1, "Dê um título.").max(160),
  durationMinutes: z.coerce.number().int().min(5).max(600),
  count: z.coerce.number().int().min(3, "Mínimo de 3 questões.").max(150),
  subjectId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => v || null),
});

/** Monta um simulado sorteando questões dos quizzes do próprio estudante (sem IA). */
export async function composeMockExam(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/app/simulados");
  const parsed = composeSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: "Revise os campos.", fieldErrors: fieldErrorsOf(parsed.error) };
  const plan = await getPlanForUser(user.id);
  if (parsed.data.count > plan.maxMockExamQuestions) {
    return { error: `O plano ${plan.name} permite até ${plan.maxMockExamQuestions} questões por simulado.` };
  }
  const supabase = await createSupabaseServerClient();
  const { data: pool } = await supabase
    .from("quiz_questions")
    .select("prompt, type, options, correct_option_id, reference_answer, explanation, topic, subject_id, points, quizzes!inner(subject_id, kind)")
    .eq("quizzes.kind", "quiz")
    .limit(3000);
  const subjectId = parsed.data.subjectId;
  const candidates = (pool ?? []).filter((q) => !subjectId || q.subject_id === subjectId || q.quizzes?.subject_id === subjectId);
  if (candidates.length < 3) return { error: "Você precisa de pelo menos 3 questões em seus quizzes para montar um simulado." };
  const shuffled = [...candidates].sort(() => Math.random() - 0.5).slice(0, parsed.data.count);

  const { data: quiz, error } = await supabase
    .from("quizzes")
    .insert({
      user_id: user.id,
      kind: "mock_exam",
      title: parsed.data.title,
      description: `Simulado montado com ${shuffled.length} questões dos seus quizzes.`,
      subject_id: parsed.data.subjectId,
      duration_minutes: parsed.data.durationMinutes,
      exam_type: "custom",
    })
    .select("id")
    .single();
  if (error || !quiz) return { error: "Não foi possível criar o simulado." };
  const { error: insertError } = await supabase.from("quiz_questions").insert(
    shuffled.map((q, index) => ({
      quiz_id: quiz.id,
      user_id: user.id,
      position: index,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      correct_option_id: q.correct_option_id,
      reference_answer: q.reference_answer,
      explanation: q.explanation,
      topic: q.topic,
      subject_id: q.subject_id ?? q.quizzes?.subject_id ?? null,
      points: q.points,
    })),
  );
  if (insertError) {
    await supabase.from("quizzes").delete().eq("id", quiz.id);
    return { error: "Não foi possível copiar as questões." };
  }
  redirect(`/app/quizzes/${quiz.id}`);
}

// Tentativas ------------------------------------------------------------------------------

export async function startAttempt(quizId: string): Promise<Result> {
  const user = await requireUser("/app/quizzes");
  const id = uuidSchema.safeParse(quizId);
  if (!id.success) return { ok: false, error: "Quiz inválido." };
  const supabase = await createSupabaseServerClient();
  const { data: quiz } = await supabase.from("quizzes").select("id, questions_count").eq("id", id.data).maybeSingle();
  if (!quiz) return { ok: false, error: "Quiz não encontrado." };
  if (!quiz.questions_count) return { ok: false, error: "Adicione questões antes de começar." };

  const { data: open } = await supabase
    .from("quiz_attempts")
    .select("id, deadline_at")
    .eq("quiz_id", quiz.id)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (open) {
    const expired = open.deadline_at && new Date(open.deadline_at).getTime() + 60_000 < Date.now();
    if (!expired) redirect(`/app/quizzes/tentativa/${open.id}`);
    // Prazo vencido com a aba fechada: corrige o que foi salvo antes de começar outra.
    try {
      await finishAttempt(open.id, user.id);
    } catch (error) {
      logger.warn("quizzes.expired_attempt_finish_failed", { name: error instanceof Error ? error.name : "unknown" });
    }
  }

  const { data: attempt, error } = await supabase.from("quiz_attempts").insert({ quiz_id: quiz.id, user_id: user.id }).select("id").single();
  if (error || !attempt) return { ok: false, error: "Não foi possível começar." };
  redirect(`/app/quizzes/tentativa/${attempt.id}`);
}

const answerSchema = z.object({
  attemptId: z.uuid(),
  questionId: z.uuid(),
  selectedOptionId: z.string().max(20).nullable().optional(),
  answerText: z.string().max(10_000).nullable().optional(),
});

/** Salva (ou troca) a resposta de uma questão. O banco recusa fora do prazo. */
export async function saveAnswer(input: z.input<typeof answerSchema>): Promise<Result> {
  const user = await requireUser("/app/quizzes");
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Resposta inválida." };
  const { attemptId, questionId } = parsed.data;
  const values = { selected_option_id: parsed.data.selectedOptionId ?? null, answer_text: parsed.data.answerText ?? null };
  const supabase = await createSupabaseServerClient();
  const { data: updated, error: updateError } = await supabase
    .from("quiz_answers")
    .update({ ...values, answered_at: new Date().toISOString() })
    .eq("attempt_id", attemptId)
    .eq("question_id", questionId)
    .select("id");
  if (!updateError && updated?.length) return { ok: true };
  const { error } = await supabase.from("quiz_answers").insert({ attempt_id: attemptId, question_id: questionId, user_id: user.id, ...values });
  if (error) {
    return { ok: false, error: error.code === "42501" ? "O tempo acabou ou a tentativa já foi entregue." : "Não foi possível salvar a resposta." };
  }
  return { ok: true };
}

export async function saveAttemptState(attemptId: string, state: { position: number; flagged: string[] }): Promise<Result> {
  await requireUser("/app/quizzes");
  const id = uuidSchema.safeParse(attemptId);
  const flagged = z.array(z.uuid()).max(300).safeParse(state.flagged);
  if (!id.success || !flagged.success || !Number.isInteger(state.position) || state.position < 0) return { ok: false, error: "Dados inválidos." };
  const supabase = await createSupabaseServerClient();
  await supabase.from("quiz_attempts").update({ current_position: state.position, flagged_question_ids: flagged.data }).eq("id", id.data);
  return { ok: true };
}

type FinishOutcome = { status: string; xp: number; unlocked: string[]; selfAssessment: boolean; notice?: string };

/** Corrige uma tentativa: objetivas no banco, abertas pela IA (se disponível) ou por autoavaliação. */
async function finishAttempt(attemptId: string, userId: string): Promise<FinishOutcome> {
  const supabase = await createSupabaseServerClient();
  const { data: submitted, error } = await supabase.rpc("submit_quiz_attempt", { p_attempt_id: attemptId });
  if (error || !submitted) throw new Error(`submit_failed:${error?.code ?? "none"}`);
  if (submitted.status === "graded") return { status: "graded", ...(await awardForAttempt(attemptId, userId)), selfAssessment: false };

  const admin = createSupabaseAdminClient();
  const { data: openAnswers } = await admin
    .from("quiz_answers")
    .select("id, answer_text, quiz_questions!inner(prompt, reference_answer, points, type)")
    .eq("attempt_id", attemptId)
    .eq("quiz_questions.type", "open")
    .is("is_correct", null)
    .not("answer_text", "is", null);
  const pending = (openAnswers ?? []).filter((a) => a.answer_text?.trim());
  if (!pending.length) {
    await admin.rpc("finalize_quiz_attempt", { p_attempt_id: attemptId });
    return { status: "graded", ...(await awardForAttempt(attemptId, userId)), selfAssessment: false };
  }

  if (!aiAvailability().available) {
    return { status: "submitted", xp: 0, unlocked: [], selfAssessment: true, notice: "Avalie suas respostas abertas comparando com a resposta esperada." };
  }
  const [plan, timezone] = await Promise.all([getPlanForUser(userId), getUserTimezone(userId)]);
  let failures = 0;
  let limited = false;
  for (const answer of pending) {
    const consumption = await consumeFeature({ userId, plan, feature: "ai_grading", timezone, metadata: { answer_id: answer.id } });
    if (!consumption.ok) {
      limited = true;
      break;
    }
    try {
      const question = answer.quiz_questions;
      const { graded, usage, model } = await gradeOpenAnswer({
        prompt: question.prompt,
        referenceAnswer: question.reference_answer ?? "",
        studentAnswer: answer.answer_text ?? "",
      });
      await admin
        .from("quiz_answers")
        .update({
          is_correct: graded.verdict === "correct",
          score: Math.round(Number(question.points) * graded.score * 100) / 100,
          feedback: { type: "ai", verdict: graded.verdict, feedback: graded.feedback, missingPoints: graded.missingPoints } as Json,
        })
        .eq("id", answer.id);
      await annotateUsage(consumption.recordId, { input_tokens: usage.inputTokens, output_tokens: usage.outputTokens, model });
    } catch (gradingError) {
      failures += 1;
      await refundUsage(consumption.recordId);
      logger.warn("quizzes.ai_grading_failed", { name: gradingError instanceof Error ? gradingError.name : "unknown" });
    }
  }
  const { count } = await admin
    .from("quiz_answers")
    .select("id, quiz_questions!inner(type)", { count: "exact", head: true })
    .eq("attempt_id", attemptId)
    .eq("quiz_questions.type", "open")
    .is("is_correct", null)
    .not("answer_text", "is", null);
  if (!count) {
    await admin.rpc("finalize_quiz_attempt", { p_attempt_id: attemptId });
    return { status: "graded", ...(await awardForAttempt(attemptId, userId)), selfAssessment: false };
  }
  return {
    status: "submitted",
    xp: 0,
    unlocked: [],
    selfAssessment: true,
    notice: limited
      ? "Seu limite de correções automáticas deste período acabou. Avalie as respostas restantes comparando com a resposta esperada."
      : failures
        ? "A correção automática falhou em algumas respostas. Avalie-as comparando com a resposta esperada."
        : undefined,
  };
}

async function awardForAttempt(attemptId: string, userId: string): Promise<{ xp: number; unlocked: string[] }> {
  const admin = createSupabaseAdminClient();
  const { data: attempt } = await admin
    .from("quiz_attempts")
    .select("id, status, correct_count, total_count, duration_seconds, quizzes(kind, subject_id, title)")
    .eq("id", attemptId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!attempt || attempt.status !== "graded" || !attempt.quizzes) return { xp: 0, unlocked: [] };
  const kind = attempt.quizzes.kind;
  const rule = kind === "quiz" ? XP_RULES.quizCompleted : XP_RULES.mockExamCompleted;
  const progress = await recordProgress({
    userId,
    timezone: await getUserTimezone(userId),
    xp: {
      amount: quizXp(kind, attempt.correct_count ?? 0, attempt.total_count ?? 0),
      dailyCap: rule.dailyCap,
      sourceType: kind === "quiz" ? "quiz_attempt" : "mock_exam_attempt",
      sourceId: attempt.id,
      reason: `${kind === "quiz" ? "Quiz" : "Simulado"}: ${attempt.quizzes.title}`.slice(0, 200),
    },
    session: attempt.duration_seconds
      ? { activityType: kind === "quiz" ? "quiz" : "mock_exam", sourceId: attempt.id, durationSeconds: attempt.duration_seconds, subjectId: attempt.quizzes.subject_id }
      : undefined,
  });
  return { xp: progress.xpAwarded, unlocked: await achievementTitles(progress.unlocked) };
}

export async function submitAttempt(attemptId: string): Promise<Result<{ xp: number; unlocked: string[]; notice?: string }>> {
  const user = await requireUser("/app/quizzes");
  const id = uuidSchema.safeParse(attemptId);
  if (!id.success) return { ok: false, error: "Tentativa inválida." };
  try {
    const outcome = await finishAttempt(id.data, user.id);
    return { ok: true, xp: outcome.xp, unlocked: outcome.unlocked, notice: outcome.notice };
  } catch (error) {
    logger.error("quizzes.submit_failed", { name: error instanceof Error ? error.message.slice(0, 60) : "unknown" });
    return { ok: false, error: "Não foi possível entregar. Tente novamente." };
  }
}

const selfAssessSchema = z.object({ answerId: z.uuid(), level: z.enum(["correct", "partial", "wrong"]) });

/** Autoavaliação de resposta aberta (quando não há correção automática). */
export async function selfAssessAnswer(input: { answerId: string; level: "correct" | "partial" | "wrong" }): Promise<Result<{ graded: boolean; xp: number }>> {
  const user = await requireUser("/app/quizzes");
  const parsed = selfAssessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const supabase = await createSupabaseServerClient();
  const { data: answer } = await supabase
    .from("quiz_answers")
    .select("id, attempt_id, quiz_questions(points, type), quiz_attempts(status)")
    .eq("id", parsed.data.answerId)
    .maybeSingle();
  if (!answer || answer.quiz_questions?.type !== "open") return { ok: false, error: "Resposta não encontrada." };
  if (answer.quiz_attempts?.status !== "submitted") return { ok: false, error: "Esta tentativa já foi corrigida." };
  const factor = parsed.data.level === "correct" ? 1 : parsed.data.level === "partial" ? 0.5 : 0;
  const admin = createSupabaseAdminClient();
  await admin
    .from("quiz_answers")
    .update({
      is_correct: parsed.data.level === "correct",
      score: Math.round(Number(answer.quiz_questions.points) * factor * 100) / 100,
      feedback: { type: "self", level: parsed.data.level } as Json,
    })
    .eq("id", answer.id)
    .eq("user_id", user.id);
  const { count } = await admin
    .from("quiz_answers")
    .select("id, quiz_questions!inner(type)", { count: "exact", head: true })
    .eq("attempt_id", answer.attempt_id)
    .eq("quiz_questions.type", "open")
    .is("is_correct", null)
    .not("answer_text", "is", null);
  if (count) {
    refresh();
    return { ok: true, graded: false, xp: 0 };
  }
  await admin.rpc("finalize_quiz_attempt", { p_attempt_id: answer.attempt_id });
  const award = await awardForAttempt(answer.attempt_id, user.id);
  refresh();
  return { ok: true, graded: true, xp: award.xp };
}

export async function deleteAttempt(attemptId: string): Promise<Result> {
  await requireUser("/app/quizzes");
  const id = uuidSchema.safeParse(attemptId);
  if (!id.success) return { ok: false, error: "Tentativa inválida." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("quiz_attempts").delete().eq("id", id.data).select("quiz_id").maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível excluir a tentativa." };
  redirect(`/app/quizzes/${data.quiz_id}`);
}
