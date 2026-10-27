"use server";

import { randomUUID } from "node:crypto";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { aiAvailability, getAIProvider } from "@/lib/ai";
import { aiTasks } from "@/lib/ai/config";
import { SAFETY_RULES } from "@/lib/ai/prompts/shared";
import { AIError, aiErrorMessages } from "@/lib/ai/types";
import { requireUser } from "@/lib/auth/session";
import { annotateUsage, consumeFeature, getPlanForUser, getUserTimezone, refundUsage } from "@/lib/billing/entitlements";
import { gradeLabel } from "@/lib/config/subjects";
import { getSubjectMap } from "@/lib/data/subjects";
import { addDays, daysBetween, localDateString, zonedTimeToUtc } from "@/lib/domain/dates";
import { XP_RULES } from "@/lib/domain/gamification";
import { adaptPlan, generatePlan, MAX_PLAN_DAYS, nextStudyDay } from "@/lib/domain/study-plan";
import { logger } from "@/lib/logger";
import { achievementTitles, recordProgress } from "@/lib/progress/record";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { planSchema, type PlanFormInput } from "@/lib/validation/plans";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const examTypeLabels: Record<PlanFormInput["examType"], string> = {
  enem: "ENEM",
  vestibular: "vestibular",
  school: "prova da escola",
  concurso: "concurso",
  other: "prova",
};

export async function createPlan(raw: unknown): Promise<Result> {
  const user = await requireUser("/app/plano");
  const parsed = planSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const input = parsed.data;
  const timezone = await getUserTimezone(user.id);
  const today = localDateString(timezone);
  if (input.examDate <= today) return { ok: false, error: "A data da prova precisa ser no futuro." };
  if (daysBetween(today, input.examDate) > MAX_PLAN_DAYS) return { ok: false, error: "Planos podem ter até 1 ano." };

  const subjectMap = await getSubjectMap();
  const subjects = input.subjects
    .filter((s) => subjectMap.has(s.subjectId))
    .map((s) => ({ ...s, name: subjectMap.get(s.subjectId)!.name }));
  if (!subjects.length) return { ok: false, error: "Escolha pelo menos uma matéria válida." };

  const planned = generatePlan({
    startDate: today,
    examDate: input.examDate,
    weekdays: input.weekdays,
    dailyMinutes: input.dailyMinutes,
    level: input.level,
    subjects,
  });
  if (!planned.length) return { ok: false, error: "Não há dias de estudo até a prova com os dias da semana escolhidos." };

  const supabase = await createSupabaseServerClient();
  const { data: plan, error } = await supabase
    .from("study_plans")
    .insert({
      user_id: user.id,
      title: input.title,
      exam_type: input.examType,
      exam_date: input.examDate,
      start_date: today,
      daily_minutes: input.dailyMinutes,
      weekdays: input.weekdays,
      level: input.level,
      topics: subjects.map((s) => ({ subjectId: s.subjectId, weight: s.weight, topics: s.topics })),
    })
    .select("id")
    .single();
  if (error || !plan) return { ok: false, error: "Não foi possível criar o plano." };

  for (let i = 0; i < planned.length; i += 300) {
    const { error: tasksError } = await supabase.from("study_plan_tasks").insert(
      planned.slice(i, i + 300).map((t) => ({
        plan_id: plan.id,
        user_id: user.id,
        scheduled_date: t.date,
        task_type: t.type,
        subject_id: t.subjectId,
        topic: t.topic,
        title: t.title.slice(0, 200),
        description: t.description,
        estimated_minutes: Math.min(300, Math.max(5, t.minutes)),
        priority: t.priority,
        position: t.position,
      })),
    );
    if (tasksError) {
      await supabase.from("study_plans").delete().eq("id", plan.id);
      logger.error("plans.tasks_insert_failed", { code: tasksError.code });
      return { ok: false, error: "Não foi possível criar as tarefas do plano." };
    }
  }

  // A prova entra no calendário (dia inteiro), ligada ao plano.
  await supabase.from("calendar_events").insert({
    user_id: user.id,
    title: `Prova: ${input.title}`.slice(0, 120),
    event_type: "exam",
    starts_at: zonedTimeToUtc(input.examDate, "00:00", timezone).toISOString(),
    ends_at: zonedTimeToUtc(input.examDate, "23:59", timezone).toISOString(),
    all_day: true,
    timezone,
    plan_id: plan.id,
    description: `Data da ${examTypeLabels[input.examType]} do plano de estudos.`,
  });
  redirect("/app/plano");
}

async function loadTask(taskId: string) {
  const id = uuidSchema.safeParse(taskId);
  if (!id.success) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("study_plan_tasks")
    .select("id, plan_id, status, scheduled_date, title, study_plans(weekdays, exam_date)")
    .eq("id", id.data)
    .maybeSingle();
  return data;
}

export async function completeTask(taskId: string): Promise<Result<{ xp: number; unlocked: string[] }>> {
  const user = await requireUser("/app/plano");
  const task = await loadTask(taskId);
  if (!task) return { ok: false, error: "Tarefa não encontrada." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("study_plan_tasks").update({ status: "done" }).eq("id", task.id);
  if (error) return { ok: false, error: "Não foi possível concluir a tarefa." };
  const progress = await recordProgress({
    userId: user.id,
    timezone: await getUserTimezone(user.id),
    xp: { ...XP_RULES.planTaskCompleted, sourceType: "plan_task", sourceId: task.id, reason: `Tarefa do plano: ${task.title}`.slice(0, 200) },
  });
  refresh();
  return { ok: true, xp: progress.xpAwarded, unlocked: await achievementTitles(progress.unlocked) };
}

export async function setTaskStatus(taskId: string, status: "pending" | "skipped"): Promise<Result> {
  await requireUser("/app/plano");
  const task = await loadTask(taskId);
  if (!task) return { ok: false, error: "Tarefa não encontrada." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("study_plan_tasks").update({ status }).eq("id", task.id);
  if (error) return { ok: false, error: "Não foi possível atualizar a tarefa." };
  refresh();
  return { ok: true };
}

export async function postponeTask(taskId: string): Promise<Result<{ date: string }>> {
  const user = await requireUser("/app/plano");
  const task = await loadTask(taskId);
  if (!task || !task.study_plans) return { ok: false, error: "Tarefa não encontrada." };
  const today = localDateString(await getUserTimezone(user.id));
  const from = task.scheduled_date < today ? addDays(today, -1) : task.scheduled_date;
  const next = nextStudyDay(from, task.study_plans.weekdays, task.study_plans.exam_date);
  if (!next) return { ok: false, error: "Não há outro dia de estudo antes da prova." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("study_plan_tasks").update({ scheduled_date: next, status: "pending" }).eq("id", task.id);
  if (error) return { ok: false, error: "Não foi possível adiar a tarefa." };
  refresh();
  return { ok: true, date: next };
}

/** Redistribui as tarefas atrasadas nos próximos dias com folga. */
export async function reorganizePlan(planId: string): Promise<Result<{ moved: number; skipped: number }>> {
  const user = await requireUser("/app/plano");
  const id = uuidSchema.safeParse(planId);
  if (!id.success) return { ok: false, error: "Plano inválido." };
  const supabase = await createSupabaseServerClient();
  const { data: plan } = await supabase.from("study_plans").select("id, exam_date, weekdays, daily_minutes").eq("id", id.data).maybeSingle();
  if (!plan) return { ok: false, error: "Plano não encontrado." };
  const { data: tasks } = await supabase
    .from("study_plan_tasks")
    .select("id, scheduled_date, estimated_minutes, priority, status")
    .eq("plan_id", plan.id)
    .limit(2000);
  const today = localDateString(await getUserTimezone(user.id));
  const { moves, skips } = adaptPlan({
    today,
    examDate: plan.exam_date,
    weekdays: plan.weekdays,
    dailyMinutes: plan.daily_minutes,
    tasks: (tasks ?? []).map((t) => ({ id: t.id, date: t.scheduled_date, minutes: t.estimated_minutes, priority: t.priority, status: t.status })),
  });
  for (const move of moves) await supabase.from("study_plan_tasks").update({ scheduled_date: move.date }).eq("id", move.id);
  if (skips.length) await supabase.from("study_plan_tasks").update({ status: "skipped" }).in("id", skips);
  await supabase.from("study_plans").update({ last_adapted_at: new Date().toISOString() }).eq("id", plan.id);
  refresh();
  return { ok: true, moved: moves.length, skipped: skips.length };
}

export async function setPlanStatus(planId: string, status: "active" | "archived" | "completed"): Promise<Result> {
  await requireUser("/app/plano");
  const id = uuidSchema.safeParse(planId);
  if (!id.success) return { ok: false, error: "Plano inválido." };
  const supabase = await createSupabaseServerClient();
  if (status === "active") {
    // Um plano ativo por vez: os outros vão para o arquivo.
    await supabase.from("study_plans").update({ status: "archived" }).eq("status", "active").neq("id", id.data);
  }
  const { error } = await supabase.from("study_plans").update({ status }).eq("id", id.data);
  if (error) return { ok: false, error: "Não foi possível atualizar o plano." };
  refresh();
  return { ok: true };
}

export async function deletePlan(planId: string): Promise<Result> {
  await requireUser("/app/plano");
  const id = uuidSchema.safeParse(planId);
  if (!id.success) return { ok: false, error: "Plano inválido." };
  const supabase = await createSupabaseServerClient();
  await supabase.from("calendar_events").delete().eq("plan_id", id.data).eq("event_type", "exam");
  const { data, error } = await supabase.from("study_plans").delete().eq("id", id.data).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: "Não foi possível excluir o plano." };
  redirect("/app/plano?plano-excluido=1");
}

const suggestSchema = z.object({ subjectId: z.uuid(), examType: z.enum(["enem", "vestibular", "school", "concurso", "other"]) });

/** Sugestão de tópicos com IA (o estudante revisa antes de usar). */
export async function suggestTopics(input: { subjectId: string; examType: string }): Promise<Result<{ topics: string[] }>> {
  const user = await requireUser("/app/plano");
  const parsed = suggestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  if (!aiAvailability().available) return { ok: false, error: aiErrorMessages.not_configured };
  const subject = (await getSubjectMap()).get(parsed.data.subjectId);
  if (!subject) return { ok: false, error: "Matéria inválida." };
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase.from("profiles").select("school_stage, grade_year").eq("id", user.id).maybeSingle();
  const [plan, timezone] = await Promise.all([getPlanForUser(user.id), getUserTimezone(user.id)]);
  const consumption = await consumeFeature({ userId: user.id, plan, feature: "ai_chat_message", timezone, metadata: { action: "plan_topics" } });
  if (!consumption.ok) return { ok: false, error: "Você atingiu o limite de uso da IA neste período." };
  try {
    const result = await getAIProvider().generateObject({
      ...aiTasks.planTopics,
      system: `Você organiza conteúdos de estudo para estudantes brasileiros. Liste tópicos que realmente caem na prova indicada, na ordem em que faz sentido estudar. Use nomes curtos (até 8 palavras), sem numeração.\n${SAFETY_RULES}`,
      prompt: `Matéria: ${subject.name}. Prova: ${examTypeLabels[parsed.data.examType]}. Etapa: ${gradeLabel(profile?.school_stage, profile?.grade_year) ?? "não informada"}. Liste de 8 a 15 tópicos.`,
      schema: z.object({ topics: z.array(z.string()) }),
      schemaName: "topicos",
    });
    const topics = [...new Set(result.data.topics.map((t) => t.trim()).filter((t) => t && t.length <= 160))].slice(0, 20);
    await annotateUsage(consumption.recordId, { input_tokens: result.usage.inputTokens, output_tokens: result.usage.outputTokens, model: result.model });
    if (!topics.length) throw new AIError("invalid_output");
    return { ok: true, topics };
  } catch (error) {
    await refundUsage(consumption.recordId);
    const code = error instanceof AIError ? error.code : "provider_error";
    return { ok: false, error: aiErrorMessages[code] };
  }
}

// Cronômetro de foco ------------------------------------------------------------------------

const focusSchema = z.object({ subjectId: z.uuid().nullable().optional(), taskId: z.uuid().nullable().optional() });

/** O início fica no servidor: a duração não pode ser inventada pelo navegador. */
export async function startFocus(input: { subjectId?: string | null; taskId?: string | null }): Promise<Result<{ startedAt: string }>> {
  const user = await requireUser("/app/plano");
  const parsed = focusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const admin = createSupabaseAdminClient();
  const startedAt = new Date().toISOString();
  const { error } = await admin
    .from("focus_timers")
    .upsert({ user_id: user.id, subject_id: parsed.data.subjectId ?? null, task_id: parsed.data.taskId ?? null, started_at: startedAt });
  if (error) return { ok: false, error: "Não foi possível iniciar o cronômetro." };
  refresh();
  return { ok: true, startedAt };
}

export async function stopFocus(): Promise<Result<{ minutes: number; xp: number }>> {
  const user = await requireUser("/app/plano");
  const admin = createSupabaseAdminClient();
  const { data: timer } = await admin.from("focus_timers").select("started_at, subject_id").eq("user_id", user.id).maybeSingle();
  if (!timer) return { ok: false, error: "Nenhum cronômetro em andamento." };
  await admin.from("focus_timers").delete().eq("user_id", user.id);
  const seconds = Math.min(4 * 3600, Math.floor((Date.now() - new Date(timer.started_at).getTime()) / 1000));
  refresh();
  if (seconds < 60) return { ok: true, minutes: 0, xp: 0 };
  const minutes = Math.floor(seconds / 60);
  const progress = await recordProgress({
    userId: user.id,
    timezone: await getUserTimezone(user.id),
    session: { activityType: "focus", sourceId: randomUUID(), durationSeconds: seconds, subjectId: timer.subject_id },
    xp: {
      amount: XP_RULES.focusSession.perTenMinutes * Math.floor(minutes / 10),
      dailyCap: XP_RULES.focusSession.dailyCap,
      sourceType: "focus_session",
      sourceId: `${user.id}:${timer.started_at}`,
      reason: `Foco: ${minutes} min`,
    },
  });
  return { ok: true, minutes, xp: progress.xpAwarded };
}
