import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminClient, cleanupUsers, createTestUser, subjectId, supabaseAvailable, type TestUser } from "./helpers";

const available = await supabaseAvailable();
const longContent = "A fotossíntese ocorre nos cloroplastos. ".repeat(12);

describe.skipIf(!available)("comunidade: publicação, moderação e interações", () => {
  let autora: TestUser;
  let leitor: TestUser;
  let materialId: string;

  beforeAll(async () => {
    autora = await createTestUser({ displayName: "Autora" });
    leitor = await createTestUser({ displayName: "Leitor" });
    const subject = await subjectId("biologia");
    const { data, error } = await autora.client
      .from("study_materials")
      .insert({
        author_id: autora.id,
        slug: `fotossintese-${Date.now()}`,
        title: "Fotossíntese em um mapa só",
        subject_id: subject,
        content: longContent,
        tags: ["Clorofila", " clorofila ", "ATP"],
      })
      .select("id, status, tags")
      .single();
    if (error) throw error;
    materialId = data.id;
    expect(data.status).toBe("draft");
    expect(data.tags).toEqual(["atp", "clorofila"]);
  });
  afterAll(cleanupUsers);

  it("não aceita criar material já publicado nem mexer em contadores", async () => {
    const subject = await subjectId("biologia");
    const { error } = await autora.client.from("study_materials").insert({
      author_id: autora.id,
      slug: `burla-${Date.now()}`,
      title: "Tentativa de burla",
      subject_id: subject,
      status: "published",
    });
    expect(error?.code).toBe("42501");
    const counters = await autora.client
      .from("study_materials")
      .update({ views_count: 1000 })
      .eq("id", materialId);
    expect(counters.error?.code).toBe("42501");
  });

  it("rascunhos não aparecem para outras pessoas", async () => {
    const { data } = await leitor.client.from("study_materials").select("id").eq("id", materialId);
    expect(data).toEqual([]);
  });

  it("exige declaração de autoria antes de enviar para revisão", async () => {
    const { error } = await autora.client.rpc("submit_material", { p_material_id: materialId });
    expect(error?.message).toContain("autorização");
  });

  it("envia para revisão prévia e só publica com a moderação", async () => {
    await autora.client.from("study_materials").update({ copyright_declared_at: new Date().toISOString() }).eq("id", materialId);
    const { data: status } = await autora.client.rpc("submit_material", { p_material_id: materialId });
    expect(status).toBe("pending_review");
    const { data: hidden } = await leitor.client.from("study_materials").select("id").eq("id", materialId);
    expect(hidden).toEqual([]);

    await adminClient()
      .from("study_materials")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", materialId);
    const { data: visible } = await leitor.client.from("study_materials").select("id").eq("id", materialId);
    expect(visible).toHaveLength(1);
  });

  it("outra pessoa não consegue editar nem excluir o material", async () => {
    await leitor.client.from("study_materials").update({ title: "Alterado por terceiros" }).eq("id", materialId);
    const { count } = await leitor.client.from("study_materials").delete({ count: "exact" }).eq("id", materialId);
    expect(count).toBe(0);
    const { data } = await adminClient().from("study_materials").select("title").eq("id", materialId).single();
    expect(data?.title).toBe("Fotossíntese em um mapa só");
  });

  it("favoritos e avaliações atualizam os contadores; autor não se avalia", async () => {
    expect((await leitor.client.from("material_saves").insert({ user_id: leitor.id, material_id: materialId, kind: "favorite" })).error).toBeNull();
    expect((await leitor.client.from("material_ratings").insert({ user_id: leitor.id, material_id: materialId, value: 5 })).error).toBeNull();
    const own = await autora.client.from("material_ratings").insert({ user_id: autora.id, material_id: materialId, value: 5 });
    expect(own.error).not.toBeNull();
    const { data } = await adminClient()
      .from("study_materials")
      .select("favorites_count, rating_sum, rating_count")
      .eq("id", materialId)
      .single();
    expect(data).toEqual({ favorites_count: 1, rating_sum: 5, rating_count: 1 });
  });

  it("visualizações só são contadas pelo servidor, uma por pessoa por dia, sem contar o autor", async () => {
    const denied = await leitor.client.rpc("record_material_view", {
      p_material_id: materialId,
      p_viewer_key: `user:${leitor.id}`,
      p_viewer_id: leitor.id,
    });
    expect(denied.error?.code).toBe("42501");
    const admin = adminClient();
    const first = await admin.rpc("record_material_view", { p_material_id: materialId, p_viewer_key: `user:${leitor.id}`, p_viewer_id: leitor.id });
    const second = await admin.rpc("record_material_view", { p_material_id: materialId, p_viewer_key: `user:${leitor.id}`, p_viewer_id: leitor.id });
    const author = await admin.rpc("record_material_view", { p_material_id: materialId, p_viewer_key: `user:${autora.id}`, p_viewer_id: autora.id });
    expect([first.data, second.data, author.data]).toEqual([true, false, false]);
    const { data } = await admin.from("study_materials").select("views_count").eq("id", materialId).single();
    expect(data?.views_count).toBe(1);
  });

  it("denúncias de três pessoas tiram o material do ar até a revisão", async () => {
    const extra1 = await createTestUser();
    const extra2 = await createTestUser();
    for (const reporter of [leitor, extra1, extra2]) {
      const { error } = await reporter.client
        .from("material_reports")
        .insert({ material_id: materialId, reporter_id: reporter.id, reason: "copyright", details: "Cópia de livro" });
      expect(error).toBeNull();
    }
    const { data } = await adminClient().from("study_materials").select("status").eq("id", materialId).single();
    expect(data?.status).toBe("pending_review");
  });

  it("busca na biblioteca ignora acentos e só traz publicados", async () => {
    const admin = adminClient();
    await admin.from("study_materials").update({ status: "published" }).eq("id", materialId);
    const { data } = await leitor.client.rpc("search_materials", { p_query: "fotossintese" });
    expect(data?.some((row) => row.id === materialId)).toBe(true);
    const { data: none } = await leitor.client.rpc("search_materials", { p_query: "termoquimica avancada" });
    expect(none?.some((row) => row.id === materialId)).toBe(false);
  });
});

describe.skipIf(!available)("aprendizagem: correção de quizzes e prazos de simulado", () => {
  let aluna: TestUser;
  let outro: TestUser;
  let quizId: string;
  let questionIds: string[] = [];

  beforeAll(async () => {
    aluna = await createTestUser();
    outro = await createTestUser();
    const { data: quiz } = await aluna.client
      .from("quizzes")
      .insert({ user_id: aluna.id, title: "Citologia" })
      .select("id")
      .single();
    quizId = quiz!.id;
    const options = [
      { id: "a", text: "Mitocôndria" },
      { id: "b", text: "Ribossomo" },
    ];
    const { data: questions, error } = await aluna.client
      .from("quiz_questions")
      .insert([
        { quiz_id: quizId, user_id: aluna.id, position: 0, type: "multiple_choice", prompt: "Produz ATP?", options, correct_option_id: "a" },
        { quiz_id: quizId, user_id: aluna.id, position: 1, type: "multiple_choice", prompt: "Sintetiza proteínas?", options, correct_option_id: "b" },
        { quiz_id: quizId, user_id: aluna.id, position: 2, type: "true_false", prompt: "Célula vegetal tem parede?", options: [{ id: "true", text: "Verdadeiro" }, { id: "false", text: "Falso" }], correct_option_id: "true" },
      ])
      .select("id, position");
    if (error) throw error;
    questionIds = (questions ?? []).sort((a, b) => a.position - b.position).map((q) => q.id);
  });
  afterAll(cleanupUsers);

  it("corrige a tentativa no banco, sem confiar no cliente", async () => {
    const { data: attempt } = await aluna.client.from("quiz_attempts").insert({ quiz_id: quizId, user_id: aluna.id }).select("id").single();
    const answers = [
      { question_id: questionIds[0]!, selected_option_id: "a" },
      { question_id: questionIds[1]!, selected_option_id: "a" },
      { question_id: questionIds[2]!, selected_option_id: "true" },
    ];
    for (const answer of answers) {
      const { error } = await aluna.client.from("quiz_answers").insert({ attempt_id: attempt!.id, user_id: aluna.id, ...answer });
      expect(error).toBeNull();
    }
    const cheat = await aluna.client
      .from("quiz_answers")
      .update({ is_correct: true })
      .eq("attempt_id", attempt!.id);
    expect(cheat.error?.code).toBe("42501");

    const { data: graded } = await aluna.client.rpc("submit_quiz_attempt", { p_attempt_id: attempt!.id });
    expect(graded?.status).toBe("graded");
    expect(graded?.correct_count).toBe(2);
    expect(graded?.total_count).toBe(3);
    expect(Number(graded?.score)).toBe(2);

    const late = await aluna.client
      .from("quiz_answers")
      .update({ selected_option_id: "b" })
      .eq("attempt_id", attempt!.id)
      .eq("question_id", questionIds[1]!)
      .select("id");
    expect(late.data ?? []).toEqual([]);
  });

  it("outra pessoa não responde nem lê a tentativa alheia", async () => {
    const { data: attempt } = await aluna.client.from("quiz_attempts").insert({ quiz_id: quizId, user_id: aluna.id }).select("id").single();
    const { error } = await outro.client
      .from("quiz_answers")
      .insert({ attempt_id: attempt!.id, user_id: outro.id, question_id: questionIds[0]!, selected_option_id: "a" });
    expect(error).not.toBeNull();
    const { data } = await outro.client.from("quiz_attempts").select("id").eq("id", attempt!.id);
    expect(data).toEqual([]);
  });

  it("recusa respostas depois do prazo do simulado", async () => {
    const { data: exam } = await aluna.client
      .from("quizzes")
      .insert({ user_id: aluna.id, title: "Simulado", kind: "mock_exam", duration_minutes: 30 })
      .select("id")
      .single();
    const { data: question } = await aluna.client
      .from("quiz_questions")
      .insert({
        quiz_id: exam!.id,
        user_id: aluna.id,
        position: 0,
        type: "multiple_choice",
        prompt: "2 + 2?",
        options: [
          { id: "a", text: "4" },
          { id: "b", text: "5" },
        ],
        correct_option_id: "a",
      })
      .select("id")
      .single();
    const { data: attempt } = await aluna.client.from("quiz_attempts").insert({ quiz_id: exam!.id, user_id: aluna.id }).select("id, deadline_at").single();
    expect(attempt?.deadline_at).not.toBeNull();

    await adminClient()
      .from("quiz_attempts")
      .update({ deadline_at: new Date(Date.now() - 5 * 60_000).toISOString() })
      .eq("id", attempt!.id);
    const { error } = await aluna.client
      .from("quiz_answers")
      .insert({ attempt_id: attempt!.id, user_id: aluna.id, question_id: question!.id, selected_option_id: "a" });
    expect(error).not.toBeNull();
  });

  it("aplica revisão de flashcard com controle de concorrência", async () => {
    const { data: deck } = await aluna.client.from("flashcard_decks").insert({ user_id: aluna.id, title: "Deck" }).select("id").single();
    const { data: card } = await aluna.client
      .from("flashcards")
      .insert({ deck_id: deck!.id, user_id: aluna.id, front: "F", back: "B" })
      .select("id, last_review_at")
      .single();
    const params = {
      p_card_id: card!.id,
      p_rating: 3,
      p_expected_last_review: card!.last_review_at as unknown as string,
      p_state: "learning" as const,
      p_due_at: new Date(Date.now() + 600_000).toISOString(),
      p_stability: 2.3,
      p_difficulty: 5.1,
      p_elapsed_days: 0,
      p_scheduled_days: 0,
      p_learning_steps: 1,
      p_reps: 1,
      p_lapses: 0,
      p_reviewed_at: new Date().toISOString(),
      p_duration_ms: 4000,
    };
    const first = await aluna.client.rpc("apply_flashcard_review", params);
    expect(first.error).toBeNull();
    const duplicate = await aluna.client.rpc("apply_flashcard_review", params);
    expect(duplicate.error?.code).toBe("40001");
    const stranger = await outro.client.rpc("apply_flashcard_review", params);
    expect(stranger.error?.code).toBe("P0002");
  });
});
