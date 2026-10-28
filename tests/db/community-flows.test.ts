import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { adminClient, cleanupUsers, createTestUser, subjectId, supabaseAvailable, url, type Client, type TestUser } from "./helpers";

/**
 * Comunidade e pastas com as Server Actions reais contra o Supabase local.
 * Só a sessão do Next (cookies), o roteamento e a IA são substituídos.
 */
const state = vi.hoisted(() => ({ client: null as unknown as Client, userId: "" }));

class RedirectSignal extends Error {
  constructor(public readonly url: string) {
    super(`redirect:${url}`);
  }
}

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => state.client }));
vi.mock("@/lib/auth/session", async () => {
  const { adminClient: admin } = await import("./helpers");
  return {
    requireUser: async () => ({ id: state.userId, email: null }),
    getSessionUser: async () => ({ id: state.userId, email: null }),
    getCurrentProfile: async () => (await admin().from("profiles").select("*").eq("id", state.userId).single()).data,
  };
});
vi.mock("next/cache", () => ({
  refresh: () => undefined,
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
  cacheLife: () => undefined,
  cacheTag: () => undefined,
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectSignal(to);
  },
  notFound: () => {
    throw new Error("not_found");
  },
}));
vi.mock("@/lib/ai", () => ({ aiAvailability: () => ({ available: false, reason: "no_provider" }), getAIProvider: () => null, aiSupportsImages: () => false }));

async function expectRedirect(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error("esperava redirecionamento");
}

function as(user: TestUser) {
  state.client = user.client;
  state.userId = user.id;
}

const available = await supabaseAvailable();
const longText = `# Mitose\n\n${"A mitose é a divisão celular que gera duas células-filhas idênticas. ".repeat(6)}`;

describe.skipIf(!available)("comunidade com as Server Actions", () => {
  let ana: TestUser;
  let bruno: TestUser;
  let caio: TestUser;
  let biologia: string;
  const admin = adminClient();

  beforeAll(async () => {
    ana = await createTestUser({ birthDate: "2003-04-10", displayName: "Ana Prado" });
    bruno = await createTestUser({ birthDate: "2004-09-01", displayName: "Bruno Melo" });
    caio = await createTestUser({ birthDate: `${new Date().getUTCFullYear() - 14}-02-01`, displayName: "Caio Rocha" });
    for (const u of [ana, bruno, caio]) {
      await admin.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", u.id);
    }
    biologia = await subjectId("biologia");
  });

  afterAll(async () => {
    await admin.from("app_settings").update({ value: "pre" }).eq("key", "moderation_mode");
    await cleanupUsers();
  });

  async function draft(user: TestUser, overrides: Record<string, unknown> = {}) {
    as(user);
    const { saveMaterial } = await import("@/app/app/materiais/actions");
    const result = await saveMaterial(null, {
      title: "Mitose e meiose sem mistério",
      description: "Fases, diferenças e exercícios.",
      subjectId: biologia,
      materialType: "summary",
      content: longText,
      tags: "Citologia, divisão celular",
      visibility: "public",
      copyright: true,
      ...overrides,
    });
    if (!result.ok) throw new Error(result.error);
    return result;
  }

  it("cria rascunho com endereço único e declaração de autoria", async () => {
    const created = await draft(ana);
    expect(created.status).toBe("draft");
    expect(created.slug).toMatch(/^mitose-e-meiose-sem-misterio-[a-z0-9]{6}$/);
    const { data } = await admin.from("study_materials").select("tags, copyright_declared_at, author_id").eq("id", created.id).single();
    expect(data?.tags).toEqual(["citologia", "divisão celular"]);
    expect(data?.copyright_declared_at).not.toBeNull();
    expect(data?.author_id).toBe(ana.id);
  });

  it("recusa anexar arquivo que não é da pessoa", async () => {
    as(ana);
    const { saveMaterial } = await import("@/app/app/materiais/actions");
    const result = await saveMaterial(null, { title: "Material com anexo alheio", subjectId: biologia, materialType: "notes", fileId: crypto.randomUUID() });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.fileId).toBeTruthy();
  });

  it("não envia material privado nem sem autoria declarada", async () => {
    const { submitMaterial } = await import("@/app/app/materiais/actions");
    const privado = await draft(ana, { visibility: "private" });
    expect(await submitMaterial(privado.id)).toMatchObject({ ok: false });
    const semAutoria = await draft(ana, { copyright: false });
    const result = await submitMaterial(semAutoria.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/autoriza/);
  });

  it("menor de 16 anos sem consentimento recebe a explicação do banco", async () => {
    const { submitMaterial } = await import("@/app/app/materiais/actions");
    const created = await draft(caio);
    const result = await submitMaterial(created.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/16 anos|responsável/);
  });

  it("na moderação prévia o envio fica em revisão e o histórico registra cada passo", async () => {
    const { submitMaterial, withdrawMaterial } = await import("@/app/app/materiais/actions");
    const created = await draft(ana);
    expect(await submitMaterial(created.id)).toMatchObject({ ok: true, status: "pending_review" });
    expect(await withdrawMaterial(created.id)).toMatchObject({ ok: true });
    const { data: events } = await ana.client.from("material_events").select("event, to_status").eq("material_id", created.id).order("id");
    expect(events?.map((e) => e.event)).toEqual(["created", "submitted", "withdrawn"]);
    // Quem moderou nunca é revelado ao autor.
    const { error } = await ana.client.from("material_events").select("actor_id").eq("material_id", created.id);
    expect(error).not.toBeNull();
    // Outra pessoa não vê o histórico.
    const { data: others } = await bruno.client.from("material_events").select("id").eq("material_id", created.id);
    expect(others).toEqual([]);
  });

  it("na moderação posterior publica na hora e dá XP uma única vez", async () => {
    await admin.from("app_settings").update({ value: "post" }).eq("key", "moderation_mode");
    const { submitMaterial, withdrawMaterial } = await import("@/app/app/materiais/actions");
    const created = await draft(ana, { title: "Fotossíntese em 5 minutos" });
    expect(await submitMaterial(created.id)).toMatchObject({ ok: true, status: "published" });
    await withdrawMaterial(created.id);
    expect(await submitMaterial(created.id)).toMatchObject({ ok: true, status: "published" });
    const { data: xp } = await admin.from("xp_transactions").select("amount").eq("user_id", ana.id).eq("source_type", "material_published");
    expect(xp).toEqual([{ amount: 25 }]);
    const { data: achievement } = await admin
      .from("user_achievements")
      .select("achievements(code)")
      .eq("user_id", ana.id);
    expect(achievement?.some((a) => (a.achievements as { code: string } | null)?.code === "autor_1")).toBe(true);
    await admin.from("app_settings").update({ value: "pre" }).eq("key", "moderation_mode");
  });

  it("edição do conteúdo publicado volta para revisão na moderação prévia", async () => {
    const { saveMaterial } = await import("@/app/app/materiais/actions");
    const { data: published } = await admin.from("study_materials").select("id").eq("author_id", ana.id).eq("status", "published").limit(1).single();
    as(ana);
    const result = await saveMaterial(published!.id, {
      title: "Fotossíntese em 5 minutos (revisado)",
      subjectId: biologia,
      materialType: "summary",
      content: `${longText}\n\nNova seção.`,
      visibility: "public",
      copyright: true,
    });
    expect(result).toMatchObject({ ok: true, status: "pending_review" });
  });

  it("salvar, favoritar, avaliar e denunciar passam pelas regras do banco", async () => {
    const { data: m } = await admin
      .from("study_materials")
      .insert({ author_id: ana.id, slug: `celula-${Date.now()}`, title: "Organelas da célula", subject_id: biologia, content: longText, copyright_declared_at: new Date().toISOString() })
      .select("id, slug")
      .single();
    await admin.from("study_materials").update({ status: "published", published_at: new Date().toISOString() }).eq("id", m!.id);
    const { rateMaterial, reportMaterial, toggleMaterialSave } = await import("@/app/(public)/biblioteca/actions");

    as(bruno);
    expect(await toggleMaterialSave(m!.id, "favorite")).toMatchObject({ ok: true, active: true });
    expect(await toggleMaterialSave(m!.id, "saved")).toMatchObject({ ok: true, active: true });
    expect(await rateMaterial(m!.id, 5)).toMatchObject({ ok: true });
    expect(await rateMaterial(m!.id, 3)).toMatchObject({ ok: true });
    expect(await reportMaterial({ materialId: m!.id, reason: "incorrect", details: "Faltou o complexo de Golgi." })).toMatchObject({ ok: true });
    expect(await reportMaterial({ materialId: m!.id, reason: "spam" })).toMatchObject({ ok: false });
    expect(await toggleMaterialSave(m!.id, "favorite")).toMatchObject({ ok: true, active: false });

    as(ana);
    expect(await rateMaterial(m!.id, 5)).toMatchObject({ ok: false });
    expect(await reportMaterial({ materialId: m!.id, reason: "other", details: "Denúncia do próprio material" })).toMatchObject({ ok: false });

    const { data: counters } = await admin.from("study_materials").select("saves_count, favorites_count, rating_sum, rating_count").eq("id", m!.id).single();
    expect(counters).toEqual({ saves_count: 1, favorites_count: 0, rating_sum: 3, rating_count: 1 });
  });

  it("pastas organizam itens sem apagar nada e não aceitam pasta alheia", async () => {
    const { addItemsToFolder, deleteFolder, moveToFolder, saveFolder } = await import("@/app/app/pastas/actions");
    as(bruno);
    const folder = await saveFolder(null, { name: "Prova de Biologia", color: "green", subjectId: biologia, examDate: "2026-12-01" });
    expect(folder.ok).toBe(true);
    if (!folder.ok) return;
    expect(await saveFolder(null, { name: "prova de biologia " })).toMatchObject({ ok: false });

    const { data: deck } = await bruno.client.from("flashcard_decks").insert({ user_id: bruno.id, title: "Citologia" }).select("id").single();
    const { data: saved } = await bruno.client.from("material_saves").select("material_id").eq("user_id", bruno.id).eq("kind", "saved").single();
    expect(
      await addItemsToFolder(folder.id, [
        { kind: "deck", id: deck!.id },
        { kind: "material", id: saved!.material_id },
      ]),
    ).toMatchObject({ ok: true, moved: 2 });

    const { listFolders } = await import("@/lib/data/folders");
    const [summary] = await listFolders();
    expect(summary).toMatchObject({ name: "Prova de Biologia", total: 2 });
    expect(summary?.counts.deck).toBe(1);
    expect(summary?.counts.material).toBe(1);

    // Pasta de outra pessoa: nem é encontrada.
    as(ana);
    const other = await saveFolder(null, { name: "Pasta da Ana" });
    as(bruno);
    if (other.ok) expect(await moveToFolder("deck", deck!.id, other.id)).toMatchObject({ ok: false });

    expect(await moveToFolder("deck", deck!.id, null)).toMatchObject({ ok: true });
    expect(await expectRedirect(deleteFolder(folder.id))).toBe("/app/pastas?pasta-excluida=1");
    const { data: stillSaved } = await admin.from("material_saves").select("folder_id").eq("user_id", bruno.id).eq("kind", "saved").single();
    expect(stillSaved?.folder_id).toBeNull();
  });

  it("estudar com IA cria uma cópia pessoal processada, sem duplicar", async () => {
    const { data: m } = await admin.from("study_materials").select("slug").eq("author_id", ana.id).eq("status", "published").eq("title", "Organelas da célula").single();
    const { studyMaterialWithAI } = await import("@/app/app/biblioteca/actions");
    as(bruno);
    const first = await studyMaterialWithAI(m!.slug);
    expect(first.ok).toBe(true);
    const second = await studyMaterialWithAI(m!.slug);
    expect(second).toMatchObject({ ok: true });
    if (first.ok && second.ok) expect(second.fileIds).toEqual(first.fileIds);
    const { data: files } = await admin.from("uploaded_files").select("original_name, status, purpose, chunk_count").eq("user_id", bruno.id);
    expect(files).toEqual([{ original_name: "Organelas da célula (biblioteca).md", status: "ready", purpose: "study", chunk_count: 1 }]);
    // Rascunho de outra pessoa não pode ser copiado.
    const hidden = await draft(ana, { title: "Rascunho escondido" });
    as(bruno);
    expect(await studyMaterialWithAI(hidden.slug)).toMatchObject({ ok: false });
  });

  it("busca de perfis respeita a privacidade e escapa curingas", async () => {
    const anon = (await import("@supabase/supabase-js")).createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const { data: brunoProfile } = await admin.from("profiles").select("username").eq("id", bruno.id).single();
    const { data: anaProfile } = await admin.from("profiles").select("username").eq("id", ana.id).single();
    // Bruno é privado e não publicou: não aparece. Ana é privada mas assina materiais públicos: aparece só o @.
    expect((await anon.rpc("search_profiles", { p_query: brunoProfile!.username })).data).toEqual([]);
    const { data: found } = await anon.rpc("search_profiles", { p_query: anaProfile!.username });
    expect(found?.[0]).toMatchObject({ username: anaProfile!.username, display_name: null });
    expect((await anon.rpc("search_profiles", { p_query: "%%" })).data).toEqual([]);
    const { data: profile } = await anon.rpc("get_public_profile", { p_username: anaProfile!.username });
    expect(profile).toMatchObject({ is_public: false, display_name: null, member_since: null, achievements: [] });
  });

  it("ninguém descobre se outra conta tem consentimento de responsável", async () => {
    await admin.from("guardian_consents").insert({
      user_id: caio.id,
      guardian_name: "Responsável Teste",
      guardian_email: "responsavel@example.com",
      token_hash: "a".repeat(64),
      status: "granted",
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    });
    const anon = (await import("@supabase/supabase-js")).createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    expect((await anon.rpc("has_guardian_consent", { p_user_id: caio.id })).data).toBe(false);
    expect((await bruno.client.rpc("has_guardian_consent", { p_user_id: caio.id })).data).toBe(false);
    expect((await caio.client.rpc("has_guardian_consent", { p_user_id: caio.id })).data).toBe(true);
  });
});
