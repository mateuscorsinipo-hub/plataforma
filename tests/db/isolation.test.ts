import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminClient, cleanupUsers, createTestUser, subjectId, supabaseAvailable, type TestUser, yearsAgo } from "./helpers";

const available = await supabaseAvailable();

describe.skipIf(!available)("perfis, privacidade e isolamento entre usuários", () => {
  let ana: TestUser;
  let bruno: TestUser;

  beforeAll(async () => {
    ana = await createTestUser({ displayName: "Ana Souza" });
    bruno = await createTestUser({ displayName: "Bruno Lima" });
  });
  afterAll(cleanupUsers);

  it("cria perfil, preferências e estatísticas no cadastro", async () => {
    const { data: profile } = await ana.client.from("profiles").select("*").eq("id", ana.id).single();
    expect(profile?.username).toMatch(/^anasouza\d{4}$/);
    expect(profile?.account_status).toBe("active");
    expect(profile?.profile_visibility).toBe("private");
    expect(profile?.terms_accepted_at).not.toBeNull();

    const { data: prefs } = await ana.client.from("user_preferences").select("timezone").eq("user_id", ana.id).single();
    expect(prefs?.timezone).toBe("America/Sao_Paulo");
    const { data: stats } = await ana.client.from("user_stats").select("xp_total, level").eq("user_id", ana.id).single();
    expect(stats).toEqual({ xp_total: 0, level: 1 });
  });

  it("não deixa um usuário ler nem alterar o perfil de outro", async () => {
    const { data } = await bruno.client.from("profiles").select("id").eq("id", ana.id);
    expect(data).toEqual([]);
    await bruno.client.from("profiles").update({ display_name: "invadido" }).eq("id", ana.id);
    const { data: still } = await adminClient().from("profiles").select("display_name").eq("id", ana.id).single();
    expect(still?.display_name).toBe("Ana Souza");
  });

  it("bloqueia a mudança do status da conta pelo próprio usuário", async () => {
    const { error } = await ana.client.from("profiles").update({ account_status: "suspended" }).eq("id", ana.id);
    expect(error?.code).toBe("42501");
  });

  it("não permite redefinir a data de nascimento depois de informada", async () => {
    const { error } = await ana.client.from("profiles").update({ birth_date: "1990-01-01" }).eq("id", ana.id);
    expect(error?.message).toContain("data de nascimento");
  });

  it("bloqueia nomes de usuário reservados", async () => {
    const { error } = await ana.client.from("profiles").update({ username: "admin" }).eq("id", ana.id);
    expect(error).not.toBeNull();
  });

  it("mantém privado o perfil de menores de 16 anos sem consentimento", async () => {
    const teen = await createTestUser({ birthDate: yearsAgo(14) });
    await teen.client.from("profiles").update({ profile_visibility: "public", show_stats_publicly: true }).eq("id", teen.id);
    const { data } = await teen.client.from("profiles").select("profile_visibility, show_stats_publicly, account_status").eq("id", teen.id).single();
    expect(data).toEqual({ profile_visibility: "private", show_stats_publicly: false, account_status: "active" });
  });

  it("deixa a conta de menores de 12 anos pendente de responsável", async () => {
    const child = await createTestUser({ birthDate: yearsAgo(10) });
    const { data } = await child.client.from("profiles").select("account_status").eq("id", child.id).single();
    expect(data?.account_status).toBe("pending_guardian");
  });

  it("isola pastas e impede apontar itens para a pasta de outra pessoa", async () => {
    const { data: folder, error } = await ana.client
      .from("folders")
      .insert({ user_id: ana.id, name: "ENEM" })
      .select("id")
      .single();
    expect(error).toBeNull();

    const { data: seen } = await bruno.client.from("folders").select("id").eq("id", folder!.id);
    expect(seen).toEqual([]);

    const { error: deleteError, count } = await bruno.client.from("folders").delete({ count: "exact" }).eq("id", folder!.id);
    expect(deleteError).toBeNull();
    expect(count).toBe(0);

    // A FK composta (folder_id, user_id) impede vincular um baralho próprio à pasta alheia.
    const { error: fkError } = await bruno.client
      .from("flashcard_decks")
      .insert({ user_id: bruno.id, title: "Intruso", folder_id: folder!.id });
    expect(fkError?.code).toBe("23503");
  });

  it("não deixa inserir dados em nome de outro usuário", async () => {
    const { error } = await bruno.client.from("flashcard_decks").insert({ user_id: ana.id, title: "Falso" });
    expect(error?.code).toBe("42501");
  });

  it("impede criar cartões no baralho de outra pessoa", async () => {
    const { data: deck } = await ana.client.from("flashcard_decks").insert({ user_id: ana.id, title: "Citologia" }).select("id").single();
    const { error } = await bruno.client
      .from("flashcards")
      .insert({ deck_id: deck!.id, user_id: bruno.id, front: "P", back: "R" });
    expect(error).not.toBeNull();
    const { data: own } = await ana.client
      .from("flashcards")
      .insert({ deck_id: deck!.id, user_id: ana.id, front: "Pergunta", back: "Resposta" })
      .select("id")
      .single();
    expect(own?.id).toBeTruthy();
    const { data: count } = await ana.client.from("flashcard_decks").select("cards_count").eq("id", deck!.id).single();
    expect(count?.cards_count).toBe(1);
  });

  it("não expõe e-mail nem dados privados no cartão público de perfil", async () => {
    const { data } = await bruno.client.from("profile_cards").select("*").eq("id", ana.id).single();
    expect(data?.username).toBeTruthy();
    expect(data?.display_name).toBeNull();
    expect(Object.keys(data ?? {})).not.toContain("email");
    expect(Object.keys(data ?? {})).not.toContain("birth_date");
  });

  it("valida o fuso horário das preferências", async () => {
    const { error } = await ana.client.from("user_preferences").update({ timezone: "Lua/Base" }).eq("user_id", ana.id);
    expect(error).not.toBeNull();
  });

  it("disciplinas são públicas e só leitura", async () => {
    const id = await subjectId("biologia");
    expect(id).toBeTruthy();
    const { error } = await ana.client.from("subjects").update({ name: "Hackeada" }).eq("id", id);
    const { data } = await adminClient().from("subjects").select("name").eq("id", id).single();
    expect(error === null || error.code === "42501").toBe(true);
    expect(data?.name).toBe("Biologia");
  });
});
