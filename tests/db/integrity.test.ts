import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminClient, cleanupUsers, createTestUser, subjectId, supabaseAvailable, type TestUser } from "./helpers";

const available = await supabaseAvailable();

describe.skipIf(!available)("XP, consumo e funções exclusivas do servidor", () => {
  let ana: TestUser;

  beforeAll(async () => {
    ana = await createTestUser();
  });
  afterAll(cleanupUsers);

  it("o usuário não consegue se dar XP", async () => {
    const { error } = await ana.client.rpc("award_xp", {
      p_user_id: ana.id,
      p_amount: 1000,
      p_source_type: "quiz_completed",
      p_source_id: "falso",
      p_reason: "trapaça",
      p_local_date: "2026-10-27",
    });
    expect(error?.code).toBe("42501");
  });

  it("o servidor concede XP de forma idempotente e atualiza nível e sequência", async () => {
    const admin = adminClient();
    const first = await admin.rpc("award_xp", {
      p_user_id: ana.id,
      p_amount: 60,
      p_source_type: "quiz_completed",
      p_source_id: "attempt-1",
      p_reason: "Quiz concluído",
      p_local_date: "2026-10-26",
    });
    const again = await admin.rpc("award_xp", {
      p_user_id: ana.id,
      p_amount: 60,
      p_source_type: "quiz_completed",
      p_source_id: "attempt-1",
      p_reason: "Quiz concluído",
      p_local_date: "2026-10-26",
    });
    expect(first.data).toBe(60);
    expect(again.data).toBe(0);

    await admin.rpc("award_xp", {
      p_user_id: ana.id,
      p_amount: 10,
      p_source_type: "flashcard_review",
      p_source_id: "card-1:2026-10-27",
      p_reason: "Revisão",
      p_local_date: "2026-10-27",
    });
    const { data: stats } = await ana.client.from("user_stats").select("xp_total, level, current_streak, longest_streak").eq("user_id", ana.id).single();
    expect(stats).toEqual({ xp_total: 70, level: 2, current_streak: 2, longest_streak: 2 });
  });

  it("respeita o teto diário por tipo de atividade", async () => {
    const admin = adminClient();
    let total = 0;
    for (let i = 0; i < 5; i += 1) {
      const { data } = await admin.rpc("award_xp", {
        p_user_id: ana.id,
        p_amount: 20,
        p_source_type: "plan_task",
        p_source_id: `task-${i}`,
        p_reason: "Tarefa",
        p_local_date: "2026-10-27",
        p_daily_cap: 50,
      });
      total += data ?? 0;
    }
    expect(total).toBe(50);
  });

  it("não deixa o usuário gravar XP, conquistas ou consumo diretamente", async () => {
    const xp = await ana.client.from("xp_transactions").insert({
      user_id: ana.id,
      amount: 500,
      source_type: "hack",
      source_id: "x",
      local_date: "2026-10-27",
    });
    expect(xp.error?.code).toBe("42501");
    const usage = await ana.client.from("usage_records").insert({ user_id: ana.id, feature: "ai_generation", period_key: "m:2026-10" });
    expect(usage.error?.code).toBe("42501");
    const stats = await ana.client.from("user_stats").update({ xp_total: 99999 }).eq("user_id", ana.id);
    expect(stats.error?.code).toBe("42501");
  });

  it("reserva consumo de forma atômica e respeita o limite", async () => {
    const admin = adminClient();
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        admin.rpc("consume_usage", {
          p_user_id: ana.id,
          p_feature: "ai_chat_message",
          p_quantity: 1,
          p_limit: 3,
          p_period_key: "d:2026-10-27",
        }),
      ),
    );
    const allowed = results.filter((r) => r.data?.[0]?.allowed).length;
    expect(allowed).toBe(3);
    const denied = await ana.client.rpc("consume_usage", {
      p_user_id: ana.id,
      p_feature: "ai_chat_message",
      p_quantity: 1,
      p_limit: 1000,
      p_period_key: "d:2026-10-27",
    });
    expect(denied.error?.code).toBe("42501");
  });

  it("limita requisições numa janela fixa", async () => {
    const admin = adminClient();
    const key = `teste:${ana.id}`;
    const outcomes: boolean[] = [];
    for (let i = 0; i < 4; i += 1) {
      const { data } = await admin.rpc("check_rate_limit", { p_key: key, p_limit: 3, p_window_seconds: 3600 });
      outcomes.push(Boolean(data));
    }
    expect(outcomes).toEqual([true, true, true, false]);
  });

  it("desbloqueia conquistas uma única vez e notifica", async () => {
    const admin = adminClient();
    const { data: first } = await admin.rpc("check_achievements", { p_user_id: ana.id, p_local_date: "2026-10-27" });
    expect(first).toContain("primeiro_passo");
    const { data: second } = await admin.rpc("check_achievements", { p_user_id: ana.id, p_local_date: "2026-10-27" });
    expect(second).not.toContain("primeiro_passo");
    const { data: notes } = await ana.client.from("notifications").select("type, title").eq("user_id", ana.id);
    expect(notes?.some((n) => n.type === "achievement_unlocked")).toBe(true);
  });

  it("o usuário marca notificações como lidas mas não cria notificações", async () => {
    const { data: notes } = await ana.client.from("notifications").select("id").eq("user_id", ana.id).limit(1);
    const id = notes?.[0]?.id;
    expect(id).toBeTruthy();
    const { error } = await ana.client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id!);
    expect(error).toBeNull();
    const insert = await ana.client.from("notifications").insert({ user_id: ana.id, type: "system", title: "Falsa" });
    expect(insert.error?.code).toBe("42501");
  });

  it("ranking mostra só quem aceita aparecer", async () => {
    const hidden = await createTestUser({ displayName: "Oculto" });
    await hidden.client.from("profiles").update({ show_in_leaderboard: false }).eq("id", hidden.id);
    const admin = adminClient();
    await admin.rpc("award_xp", {
      p_user_id: hidden.id,
      p_amount: 500,
      p_source_type: "quiz_completed",
      p_source_id: "h1",
      p_reason: "Quiz",
      p_local_date: "2026-10-27",
    });
    const { data: board } = await ana.client.rpc("get_league_leaderboard", { p_limit: 50 });
    expect(board?.some((row) => row.user_id === hidden.id)).toBe(false);
    const { data: own } = await hidden.client.rpc("get_league_leaderboard", { p_limit: 50 });
    expect(own?.some((row) => row.user_id === hidden.id && row.is_me)).toBe(true);
  });

  it("subjects seed existe para os testes", async () => {
    expect(await subjectId()).toBeTruthy();
  });
});
