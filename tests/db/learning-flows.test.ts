import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { adminClient, cleanupUsers, createTestUser, supabaseAvailable, type Client, type TestUser } from "./helpers";

/**
 * Ações reais de aprendizagem (flashcards, quizzes, plano, calendário) contra o
 * Supabase local. Só a sessão do Next (cookies), o roteamento e a IA são substituídos.
 */
const state = vi.hoisted(() => ({ client: null as unknown as Client, userId: "" }));

class RedirectSignal extends Error {
  constructor(public readonly url: string) {
    super(`redirect:${url}`);
  }
}

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => state.client }));
vi.mock("@/lib/auth/session", () => ({
  requireUser: async () => ({ id: state.userId, email: null }),
  getSessionUser: async () => ({ id: state.userId, email: null }),
}));
vi.mock("next/cache", () => ({ refresh: () => undefined, revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url);
  },
  notFound: () => {
    throw new Error("not_found");
  },
}));
vi.mock("@/lib/ai", () => ({ aiAvailability: () => ({ available: false, reason: "no_provider" }), getAIProvider: () => null, aiSupportsImages: () => false }));
// O cache de dados públicos do Next não existe nos testes: lê as disciplinas direto.
vi.mock("@/lib/data/subjects", async () => {
  const { adminClient: admin } = await import("./helpers");
  const load = async () => (await admin().from("subjects").select("id, slug, name, color, icon, kind, sort_order").eq("is_active", true)).data ?? [];
  return { getSubjects: load, getSubjectMap: async () => new Map((await load()).map((s) => [s.id, s])) };
});

async function expectRedirect(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error("esperava redirecionamento");
}

const available = await supabaseAvailable();

describe.skipIf(!available)("fluxos de aprendizagem com o banco", () => {
  let user: TestUser;
  const admin = adminClient();

  beforeAll(async () => {
    user = await createTestUser({ birthDate: "2007-03-10" });
    state.client = user.client;
    state.userId = user.id;
    await admin.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", user.id);
  });

  afterAll(cleanupUsers);

  async function xp(sourceType: string) {
    const { data } = await admin.from("xp_transactions").select("amount, source_id").eq("user_id", user.id).eq("source_type", sourceType);
    return data ?? [];
  }

  describe("flashcards", () => {
    let cardId = "";

    it("revisão é agendada no servidor, gravada uma vez e rende XP com teto", async () => {
      const { data: deck } = await user.client.from("flashcard_decks").insert({ user_id: user.id, title: "Citologia" }).select("id").single();
      const { data: card } = await user.client
        .from("flashcards")
        .insert({ user_id: user.id, deck_id: deck!.id, front: "Organela da respiração?", back: "Mitocôndria" })
        .select("id")
        .single();
      cardId = card!.id;
      const { reviewCard } = await import("@/app/app/flashcards/actions");
      const result = await reviewCard({ cardId, rating: 3, durationMs: 4000 });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.card.state).toBe("learning");
      expect(result.xp).toBe(2);
      const { data: stored } = await user.client.from("flashcards").select("reps, state, last_review_at").eq("id", cardId).single();
      expect(stored).toMatchObject({ reps: 1, state: "learning" });
      const { data: sessions } = await admin.from("study_sessions").select("duration_seconds").eq("user_id", user.id).eq("activity_type", "flashcards");
      expect(sessions?.[0]?.duration_seconds).toBe(4);
    });

    it("recusa revisão concorrente com a versão antiga do cartão", async () => {
      const { data: card } = await user.client.from("flashcards").select("*").eq("id", cardId).single();
      // Simula outra aba que leu o cartão antes da revisão anterior.
      const { error } = await user.client.rpc("apply_flashcard_review", {
        p_card_id: cardId,
        p_rating: 3,
        p_expected_last_review: "2020-01-01T00:00:00Z",
        p_state: "review",
        p_due_at: new Date(Date.now() + 86_400_000).toISOString(),
        p_stability: 1,
        p_difficulty: 5,
        p_elapsed_days: 0,
        p_scheduled_days: 1,
        p_learning_steps: 0,
        p_reps: card!.reps + 1,
        p_lapses: 0,
        p_reviewed_at: new Date().toISOString(),
        p_duration_ms: 1000,
      });
      expect(error?.code).toBe("40001");
    });

    it("importa cartões e ignora linhas sem separador", async () => {
      const { data: deck } = await user.client.from("flashcard_decks").insert({ user_id: user.id, title: "Importados" }).select("id").single();
      const { importCards } = await import("@/app/app/flashcards/actions");
      const result = await importCards(deck!.id, "Mitose;Divisão equacional\nsem separador\nMeiose;Divisão reducional");
      expect(result).toMatchObject({ ok: true, imported: 2, skipped: [2] });
      const { data: refreshed } = await user.client.from("flashcard_decks").select("cards_count").eq("id", deck!.id).single();
      expect(refreshed?.cards_count).toBe(2);
    });
  });

  describe("quizzes", () => {
    let quizId = "";
    let attemptId = "";

    it("monta um quiz com os três tipos de questão", async () => {
      const { data: quiz } = await user.client.from("quizzes").insert({ user_id: user.id, title: "Funções" }).select("id").single();
      quizId = quiz!.id;
      const { saveQuestion } = await import("@/app/app/quizzes/actions");
      expect(
        await saveQuestion(quizId, null, { type: "multiple_choice", prompt: "Raízes de x²−6x+9?", options: ["0", "1", "2"], correctIndex: 1, topic: "Discriminante" }),
      ).toMatchObject({ ok: true });
      expect(await saveQuestion(quizId, null, { type: "true_false", prompt: "a<0 ⇒ concavidade para baixo", correct: true })).toMatchObject({ ok: true });
      expect(await saveQuestion(quizId, null, { type: "open", prompt: "Como achar o vértice?", referenceAnswer: "x = -b/2a" })).toMatchObject({ ok: true });
      expect(await saveQuestion(quizId, null, { type: "multiple_choice", prompt: "x", options: ["a", "A"], correctIndex: 0 })).toMatchObject({ ok: false });
      const { data: refreshed } = await user.client.from("quizzes").select("questions_count").eq("id", quizId).single();
      expect(refreshed?.questions_count).toBe(3);
    });

    it("tentativa: respostas salvas, objetivas corrigidas no banco, aberta por autoavaliação", async () => {
      const { startAttempt, saveAnswer, submitAttempt, selfAssessAnswer } = await import("@/app/app/quizzes/actions");
      const url = await expectRedirect(startAttempt(quizId));
      attemptId = url.split("/").pop()!;
      const { data: questions } = await user.client.from("quiz_questions").select("id, type").eq("quiz_id", quizId).order("position");
      const [mc, tf, open] = questions!;
      expect(await saveAnswer({ attemptId, questionId: mc!.id, selectedOptionId: "a" })).toMatchObject({ ok: true });
      expect(await saveAnswer({ attemptId, questionId: mc!.id, selectedOptionId: "b" })).toMatchObject({ ok: true });
      expect(await saveAnswer({ attemptId, questionId: tf!.id, selectedOptionId: "false" })).toMatchObject({ ok: true });
      expect(await saveAnswer({ attemptId, questionId: open!.id, answerText: "Uso -b/2a" })).toMatchObject({ ok: true });

      const submitted = await submitAttempt(attemptId);
      expect(submitted).toMatchObject({ ok: true });
      const { data: attempt } = await user.client.from("quiz_attempts").select("status, correct_count").eq("id", attemptId).single();
      expect(attempt).toMatchObject({ status: "submitted", correct_count: 1 });

      // Depois de entregar, não dá para trocar respostas.
      expect(await saveAnswer({ attemptId, questionId: mc!.id, selectedOptionId: "a" })).toMatchObject({ ok: false });

      const { data: openAnswer } = await user.client.from("quiz_answers").select("id").eq("attempt_id", attemptId).eq("question_id", open!.id).single();
      const assessed = await selfAssessAnswer({ answerId: openAnswer!.id, level: "partial" });
      expect(assessed).toMatchObject({ ok: true, graded: true });
      const { data: graded } = await user.client.from("quiz_attempts").select("status, score, max_score, correct_count").eq("id", attemptId).single();
      expect(graded).toMatchObject({ status: "graded", correct_count: 1 });
      expect(Number(graded!.score)).toBe(1.5);
      expect((await xp("quiz_attempt")).map((t) => t.amount)).toEqual([12]);
    });

    it("prazo vencido bloqueia novas respostas", async () => {
      const { data: mock } = await user.client
        .from("quizzes")
        .insert({ user_id: user.id, kind: "mock_exam", title: "Simulado curto", duration_minutes: 5 })
        .select("id")
        .single();
      const { data: question } = await user.client
        .from("quiz_questions")
        .insert({ quiz_id: mock!.id, user_id: user.id, position: 0, type: "true_false", prompt: "?", options: [{ id: "true", text: "V" }, { id: "false", text: "F" }], correct_option_id: "true" })
        .select("id")
        .single();
      const { data: attempt } = await user.client.from("quiz_attempts").insert({ quiz_id: mock!.id, user_id: user.id }).select("id, deadline_at").single();
      expect(attempt?.deadline_at).toBeTruthy();
      await admin.from("quiz_attempts").update({ deadline_at: new Date(Date.now() - 5 * 60_000).toISOString() }).eq("id", attempt!.id);
      const { saveAnswer } = await import("@/app/app/quizzes/actions");
      expect(await saveAnswer({ attemptId: attempt!.id, questionId: question!.id, selectedOptionId: "true" })).toMatchObject({ ok: false });
    });

    it("não acessa tentativa de outra pessoa", async () => {
      const other = await createTestUser();
      const { data } = await other.client.from("quiz_attempts").select("id").eq("id", attemptId);
      expect(data).toEqual([]);
      const { error } = await other.client.rpc("submit_quiz_attempt", { p_attempt_id: attemptId });
      expect(error).toBeTruthy();
    });
  });

  describe("plano de estudos", () => {
    it("cria o plano com tarefas e a prova no calendário; concluir rende XP uma vez", async () => {
      const { data: subjects } = await admin.from("subjects").select("id").in("slug", ["matematica", "fisica"]);
      const { createPlan, completeTask, postponeTask } = await import("@/app/app/plano/actions");
      const exam = new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10);
      const url = await expectRedirect(
        createPlan({
          title: "ENEM",
          examType: "enem",
          examDate: exam,
          dailyMinutes: 60,
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          level: "intermediate",
          subjects: subjects!.map((s, i) => ({ subjectId: s.id, weight: i === 0 ? 3 : 2, topics: i === 0 ? ["Funções", "Geometria"] : [] })),
        }),
      );
      expect(url).toBe("/app/plano");
      const { data: plan } = await user.client.from("study_plans").select("id").eq("status", "active").single();
      const { data: tasks } = await user.client.from("study_plan_tasks").select("id, scheduled_date").eq("plan_id", plan!.id).order("scheduled_date");
      expect(tasks!.length).toBeGreaterThan(10);
      const { data: exams } = await user.client.from("calendar_events").select("event_type, all_day").eq("plan_id", plan!.id);
      expect(exams).toEqual([{ event_type: "exam", all_day: true }]);

      const first = tasks![0]!;
      expect(await completeTask(first.id)).toMatchObject({ ok: true, xp: 8 });
      expect(await completeTask(first.id)).toMatchObject({ ok: true, xp: 0 });
      const second = tasks![1]!;
      const moved = await postponeTask(second.id);
      expect(moved.ok).toBe(true);
      if (moved.ok) expect(moved.date > second.scheduled_date || moved.date >= first.scheduled_date).toBe(true);
    });

    it("recusa prova no passado", async () => {
      const { createPlan } = await import("@/app/app/plano/actions");
      const { data: subjects } = await admin.from("subjects").select("id").eq("slug", "historia");
      const result = await createPlan({
        title: "x",
        examType: "school",
        examDate: "2020-01-01",
        dailyMinutes: 60,
        weekdays: [1],
        level: "beginner",
        subjects: [{ subjectId: subjects![0]!.id, weight: 2, topics: [] }],
      });
      expect(result).toMatchObject({ ok: false });
    });
  });

  describe("calendário", () => {
    it("avisa choque de horário e salva quando confirmado", async () => {
      const { saveEvent } = await import("@/app/app/calendario/actions");
      const date = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
      const base = { description: "", eventType: "class" as const, subjectId: "", allDay: false, recurrence: "none" as const, weekdays: [], until: "", reminderMinutes: "", location: "" };
      expect(await saveEvent(null, { ...base, title: "Aula", date, startTime: "19:00", endTime: "20:30" })).toMatchObject({ ok: true });
      const conflict = await saveEvent(null, { ...base, title: "Grupo", date, startTime: "20:00", endTime: "21:00" });
      expect(conflict).toMatchObject({ ok: false });
      expect(conflict.ok ? [] : conflict.conflicts).toEqual([expect.stringContaining("Aula")]);
      expect(await saveEvent(null, { ...base, title: "Grupo", date, startTime: "20:00", endTime: "21:00" }, { confirmConflicts: true })).toMatchObject({ ok: true });
      expect(await saveEvent(null, { ...base, title: "Depois", date, startTime: "20:30", endTime: "21:30" })).toMatchObject({ ok: false });
      expect(await saveEvent(null, { ...base, title: "Ruim", date, startTime: "10:00", endTime: "09:00" })).toMatchObject({ ok: false });
    });
  });
});
