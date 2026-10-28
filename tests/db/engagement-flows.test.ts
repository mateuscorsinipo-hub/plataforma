import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { adminClient, cleanupUsers, createTestUser, supabaseAvailable, type Client, type TestUser } from "./helpers";

/**
 * Engajamento com o banco real: métricas semanais verificáveis, resgate idempotente
 * dos desafios, progresso das conquistas e privacidade do ranking da liga.
 */
const state = vi.hoisted(() => ({ client: null as unknown as Client, userId: "" }));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => state.client }));
vi.mock("@/lib/auth/session", async () => {
  const { adminClient: admin } = await import("./helpers");
  return {
    requireUser: async () => ({ id: state.userId, email: null }),
    getSessionUser: async () => ({ id: state.userId, email: null }),
    getCurrentProfile: async () => (await admin().from("profiles").select("*").eq("id", state.userId).single()).data,
  };
});
vi.mock("next/cache", () => ({ refresh: () => undefined, revalidatePath: () => undefined, revalidateTag: () => undefined }));

const available = await supabaseAvailable();

describe.skipIf(!available)("engajamento: desafios, conquistas e liga", () => {
  let dani: TestUser;
  let edu: TestUser;
  let fabi: TestUser;
  let monday = "";
  const admin = adminClient();

  async function seedActivity(user: TestUser) {
    const { localDateString, weekStart, addDays } = await import("@/lib/domain/dates");
    const today = localDateString("America/Sao_Paulo");
    monday = weekStart(today);
    // Baralho com um cartão e 60 revisões gravadas pelo servidor.
    const { data: deck } = await admin.from("flashcard_decks").insert({ user_id: user.id, title: "Biologia" }).select("id").single();
    const { data: card } = await admin.from("flashcards").insert({ user_id: user.id, deck_id: deck!.id, front: "Mitose", back: "Divisão celular" }).select("id").single();
    await admin.from("flashcard_reviews").insert(
      Array.from({ length: 60 }, () => ({ card_id: card!.id, user_id: user.id, rating: 3, state_before: "review" as const })),
    );
    // Quiz de 5 questões entregue 6 vezes (30 acertos) e um simulado entregue.
    const { data: quiz } = await admin.from("quizzes").insert({ user_id: user.id, title: "Citologia" }).select("id").single();
    const questions = await admin
      .from("quiz_questions")
      .insert(
        Array.from({ length: 5 }, (_, i) => ({
          quiz_id: quiz!.id,
          user_id: user.id,
          position: i,
          type: "true_false" as const,
          prompt: `Afirmação ${i + 1}`,
          options: [
            { id: "v", text: "Verdadeiro" },
            { id: "f", text: "Falso" },
          ],
          correct_option_id: "v",
        })),
      )
      .select("id");
    for (let i = 0; i < 6; i++) {
      const { data: attempt } = await admin.from("quiz_attempts").insert({ quiz_id: quiz!.id, user_id: user.id }).select("id").single();
      await admin
        .from("quiz_answers")
        .insert(questions.data!.map((q) => ({ attempt_id: attempt!.id, user_id: user.id, question_id: q.id, selected_option_id: "v", is_correct: true })));
      await admin.from("quiz_attempts").update({ status: "graded", submitted_at: new Date().toISOString(), graded_at: new Date().toISOString() }).eq("id", attempt!.id);
    }
    const { data: mock } = await admin.from("quizzes").insert({ user_id: user.id, title: "Simulado", kind: "mock_exam", duration_minutes: 60 }).select("id").single();
    const { data: mockAttempt } = await admin.from("quiz_attempts").insert({ quiz_id: mock!.id, user_id: user.id }).select("id").single();
    await admin.from("quiz_attempts").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", mockAttempt!.id);
    // Sessões de foco de 30 minutos em quatro dias desta semana (registradas pelo servidor).
    await admin.from("study_sessions").insert(
      Array.from({ length: 5 }, (_, i) => {
        const day = addDays(monday, Math.min(i, 3));
        const ended = new Date(`${day}T15:00:00Z`);
        return {
          user_id: user.id,
          activity_type: "focus",
          source_id: crypto.randomUUID(),
          started_at: new Date(ended.getTime() - 1800 * 1000).toISOString(),
          ended_at: ended.toISOString(),
          duration_seconds: 1800,
          local_date: day,
        };
      }),
    );
  }

  beforeAll(async () => {
    dani = await createTestUser({ birthDate: "2005-05-05", displayName: "Dani Alves" });
    edu = await createTestUser({ birthDate: "2006-06-06", displayName: "Edu Lima" });
    fabi = await createTestUser({ birthDate: "2006-07-07", displayName: "Fabi Rios" });
    await seedActivity(dani);
  });

  afterAll(cleanupUsers);

  it("mede só atividade verificável da semana", async () => {
    const { addDays } = await import("@/lib/domain/dates");
    const { data } = await dani.client.rpc("weekly_activity", { p_from: monday, p_to: addDays(monday, 6), p_tz: "America/Sao_Paulo" });
    expect(data?.[0]).toEqual({
      flashcard_reviews: 60,
      quizzes_completed: 6,
      mock_exams: 1,
      correct_answers: 30,
      study_minutes: 150,
      active_days: 4,
      focus_sessions: 5,
    });
    // Outra pessoa não enxerga a atividade da Dani.
    const { data: other } = await edu.client.rpc("weekly_activity", { p_from: monday, p_to: addDays(monday, 6), p_tz: "America/Sao_Paulo" });
    expect(other?.[0]?.flashcard_reviews).toBe(0);
  });

  it("resgata cada desafio uma única vez e recusa o que não foi cumprido", async () => {
    const { claimWeeklyChallenge } = await import("@/app/app/conquistas/actions");
    const { challengesForWeek } = await import("@/lib/domain/challenges");
    state.client = dani.client;
    state.userId = dani.id;
    const challenges = challengesForWeek(monday, { dailyGoalMinutes: 30 });
    for (const c of challenges) {
      expect(await claimWeeklyChallenge(c.code)).toMatchObject({ ok: true, xp: 50 });
      expect(await claimWeeklyChallenge(c.code)).toMatchObject({ ok: false });
    }
    expect(await claimWeeklyChallenge("inexistente")).toMatchObject({ ok: false });
    const { data: rows } = await admin.from("xp_transactions").select("amount").eq("user_id", dani.id).eq("source_type", "weekly_challenge");
    expect(rows).toHaveLength(3);

    state.client = edu.client;
    state.userId = edu.id;
    expect(await claimWeeklyChallenge(challenges[0]!.code)).toMatchObject({ ok: false, error: "O desafio ainda não foi concluído." });
  });

  it("mostra o progresso das conquistas e libera as cumpridas", async () => {
    const { data } = await dani.client.rpc("my_achievements");
    const reviews = data?.find((a) => a.code === "revisor_50");
    expect(reviews).toMatchObject({ progress: 50, threshold: 50 });
    expect(reviews?.unlocked_at).not.toBeNull();
    const big = data?.find((a) => a.code === "revisor_500");
    expect(big).toMatchObject({ progress: 60, unlocked_at: null });
    expect((await adminClient().rpc("my_achievements")).data).toEqual([]);
  });

  it("a liga só lista quem aceita aparecer, mas cada um sempre se vê", async () => {
    // Fabi ganha XP mas não quer aparecer no ranking.
    await admin.from("profiles").update({ show_in_leaderboard: false }).eq("id", fabi.id);
    const { localDateString } = await import("@/lib/domain/dates");
    await admin.rpc("award_xp", {
      p_user_id: fabi.id,
      p_amount: 500,
      p_source_type: "teste",
      p_source_id: crypto.randomUUID(),
      p_reason: "teste",
      p_local_date: localDateString("America/Sao_Paulo"),
    });
    const { data: board } = await dani.client.rpc("get_league_leaderboard", { p_limit: 100 });
    const ids = (board ?? []).map((r) => r.user_id);
    expect(ids).toContain(dani.id);
    expect(ids).not.toContain(fabi.id);
    const { data: own } = await fabi.client.rpc("get_league_leaderboard", { p_limit: 100 });
    expect(own?.find((r) => r.is_me)?.user_id).toBe(fabi.id);

    const { data: status } = await fabi.client.rpc("my_league_status");
    expect(status?.[0]).toMatchObject({ league: "bronze", xp: 500 });
    expect(Number(status?.[0]?.rank)).toBeGreaterThanOrEqual(1);
    const { data: eduStatus } = await edu.client.rpc("my_league_status");
    expect(eduStatus?.[0]).toMatchObject({ xp: 0, rank: null });
  });
});
