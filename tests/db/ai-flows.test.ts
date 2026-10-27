import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { AIProvider, ChatRequest, ObjectRequest, StreamEvent, TextRequest } from "@/lib/ai/types";

import { makePdf } from "../support/fixtures";
import { adminClient, cleanupUsers, createTestUser, supabaseAvailable, type Client, type TestUser } from "./helpers";

/**
 * Fluxos de IA contra o Supabase local. O provedor de IA é substituído por um
 * dublê APENAS aqui (o app não tem modo simulado); o resto é real: RLS, Storage,
 * consumo, estorno e gravação das mensagens.
 */
const state = vi.hoisted(() => ({
  client: null as unknown as Client,
  provider: null as unknown as AIProvider,
  lastChat: null as ChatRequest | null,
  lastObject: null as ObjectRequest<unknown> | null,
  textCalls: [] as TextRequest[],
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => state.client }));
vi.mock("@/lib/ai", () => ({
  getAIProvider: () => state.provider,
  aiAvailability: () => ({ available: true }),
  aiSupportsImages: () => true,
}));

const usage = { inputTokens: 120, outputTokens: 40, cacheReadTokens: 0, cacheWriteTokens: 0 };

function fakeProvider(overrides: Partial<AIProvider> = {}): AIProvider {
  return {
    id: "anthropic",
    supportsImages: true,
    supportsPdf: true,
    async *streamChat(request: ChatRequest): AsyncIterable<StreamEvent> {
      state.lastChat = request;
      yield { type: "thinking" };
      yield { type: "text", text: "A fase clara ocorre nos tilacoides " };
      yield { type: "text", text: "[1]." };
      yield { type: "done", usage, model: "modelo-teste", stopReason: "end_turn" };
    },
    async generateObject<T>(request: ObjectRequest<T>) {
      state.lastObject = request as ObjectRequest<unknown>;
      return { data: {} as T, usage, model: "modelo-teste" };
    },
    async generateText(request: TextRequest) {
      state.textCalls.push(request);
      return { text: "- nota condensada", usage, model: "modelo-teste" };
    },
    ...overrides,
  };
}

const available = await supabaseAvailable();
const learner = { firstName: "Ana", schoolStage: "medio", gradeYear: 3, explanationLevel: "balanced" as const, isMinor: true };

describe.skipIf(!available)("fluxos de IA com o banco", () => {
  let user: TestUser;
  let fileId: string;
  const admin = adminClient();

  beforeAll(async () => {
    user = await createTestUser({ birthDate: "2008-04-10" });
    state.client = user.client;
    state.provider = fakeProvider();
  });

  afterAll(async () => {
    const { data } = await admin.storage.from("uploads").list(user.id);
    if (data?.length) await admin.storage.from("uploads").remove(data.map((f) => `${user.id}/${f.name}`));
    await cleanupUsers();
  });

  async function uploadRaw(name: string, bytes: Uint8Array, mime: string) {
    const path = `${user.id}/${crypto.randomUUID()}-${name}`;
    const { error } = await admin.storage.from("uploads").upload(path, bytes, { contentType: mime });
    expect(error).toBeNull();
    const { data, error: insertError } = await admin
      .from("uploaded_files")
      .insert({ user_id: user.id, storage_path: path, original_name: name, mime_type: mime, size_bytes: bytes.byteLength, purpose: "study" })
      .select("id, storage_path")
      .single();
    expect(insertError).toBeNull();
    return data!;
  }

  async function countUsage(feature: string) {
    const { count } = await admin.from("usage_records").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("feature", feature);
    return count ?? 0;
  }

  it("processa um PDF real: trechos com páginas, hash e consumo registrado", async () => {
    const { processUploadedFile } = await import("@/lib/documents/pipeline");
    const { plans } = await import("@/lib/config/plans");
    const pdf = makePdf([
      "A fase clara ocorre nos tilacoides, onde a clorofila absorve a luz.\nA agua e quebrada e libera oxigenio.\nProduz ATP e NADPH.",
      "O ciclo de Calvin ocorre no estroma do cloroplasto.\nO CO2 e fixado pela enzima rubisco.\nForma-se glicose a partir do ATP e do NADPH.",
    ]);
    const row = await uploadRaw("fotossintese.pdf", pdf, "application/pdf");
    const result = await processUploadedFile({ fileId: row.id, userId: user.id, plan: plans.free, timezone: "America/Sao_Paulo" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.status).toBe("ready");
    expect(result.file.page_count).toBe(2);
    expect(result.file.sha256).toMatch(/^[a-f0-9]{64}$/);
    const { data: chunks } = await user.client.from("document_chunks").select("page_start, page_end, content").eq("file_id", row.id);
    expect(chunks?.[0]).toMatchObject({ page_start: 1, page_end: 2 });
    expect(await countUsage("file_processing")).toBe(1);
    fileId = row.id;

    // Busca textual com o RLS do próprio usuário.
    const { data: found } = await user.client.rpc("search_document_chunks", { p_file_ids: [row.id], p_query: "tilacoides or calvin" });
    expect(found?.length).toBe(1);
  });

  it("recusa conteúdo que não bate com o tipo, apaga tudo e devolve o crédito", async () => {
    const { processUploadedFile } = await import("@/lib/documents/pipeline");
    const { plans } = await import("@/lib/config/plans");
    const row = await uploadRaw("falso.pdf", new TextEncoder().encode("apenas texto fingindo ser pdf"), "application/pdf");
    const before = await countUsage("file_processing");
    const result = await processUploadedFile({ fileId: row.id, userId: user.id, plan: plans.free, timezone: "America/Sao_Paulo" });
    expect(result).toMatchObject({ ok: false, code: "mismatched_type" });
    expect(await countUsage("file_processing")).toBe(before);
    const { data: still } = await admin.from("uploaded_files").select("id").eq("id", row.id).maybeSingle();
    expect(still).toBeNull();
    const { data: objects } = await admin.storage.from("uploads").list(user.id, { search: "falso" });
    expect(objects ?? []).toHaveLength(0);
  });

  it("lê PDF digitalizado com a IA e registra os tokens no consumo", async () => {
    const { processUploadedFile } = await import("@/lib/documents/pipeline");
    const { plans } = await import("@/lib/config/plans");
    state.provider = fakeProvider({
      async generateText(request: TextRequest) {
        state.textCalls.push(request);
        return { text: "=== Página 1 ===\nTexto manuscrito sobre mitose e meiose em células.", usage, model: "modelo-teste" };
      },
    });
    const row = await uploadRaw("caderno.pdf", makePdf([""]), "application/pdf");
    const result = await processUploadedFile({ fileId: row.id, userId: user.id, plan: plans.free, timezone: "America/Sao_Paulo" });
    expect(result.ok).toBe(true);
    const sent = state.textCalls.at(-1)?.prompt;
    expect(Array.isArray(sent) && sent[0]?.type).toBe("document");
    const { data: chunks } = await user.client.from("document_chunks").select("content, page_start").eq("file_id", row.id);
    expect(chunks?.[0]).toMatchObject({ page_start: 1 });
    expect(chunks?.[0]?.content).toContain("mitose");
    const { data: records } = await admin.from("usage_records").select("metadata").eq("user_id", user.id).eq("feature", "file_processing");
    expect(records?.some((r) => (r.metadata as Record<string, unknown>).file_id === row.id && (r.metadata as Record<string, unknown>).input_tokens === 120)).toBe(true);
    state.provider = fakeProvider();
  });

  it("não processa arquivo de outra pessoa", async () => {
    const { processUploadedFile } = await import("@/lib/documents/pipeline");
    const { plans } = await import("@/lib/config/plans");
    const other = await createTestUser();
    const result = await processUploadedFile({ fileId, userId: other.id, plan: plans.free, timezone: "America/Sao_Paulo" });
    expect(result).toMatchObject({ ok: false, code: "not_found" });
  });

  async function newConversation(question: string) {
    const { data: conversation } = await user.client.from("ai_conversations").insert({ user_id: user.id, title: "Teste" }).select("id").single();
    await user.client.from("ai_conversation_sources").insert({ conversation_id: conversation!.id, file_id: fileId, user_id: user.id });
    const { data: message } = await user.client
      .from("ai_messages")
      .insert({ conversation_id: conversation!.id, user_id: user.id, role: "user", content: question })
      .select("id")
      .single();
    return { conversationId: conversation!.id, messageId: message!.id };
  }

  async function runTurn(question: string) {
    const { runTutorTurn } = await import("@/lib/ai/tutor/chat");
    const { getReadyFiles } = await import("@/lib/data/files");
    const { plans } = await import("@/lib/config/plans");
    const ids = await newConversation(question);
    const sources = await getReadyFiles([fileId]);
    const events = [];
    for await (const event of runTutorTurn({
      userId: user.id,
      plan: plans.free,
      timezone: "America/Sao_Paulo",
      learner,
      conversation: { id: ids.conversationId, title: "Teste", summary: null, isNew: false },
      question: { id: ids.messageId, content: question, attachments: [] },
      sources,
      signal: new AbortController().signal,
    })) {
      events.push(event);
    }
    const { data: saved } = await user.client
      .from("ai_messages")
      .select("content, status, citations, error_code, input_tokens")
      .eq("conversation_id", ids.conversationId)
      .eq("role", "assistant");
    return { events, saved: saved ?? [] };
  }

  it("tutor: envia trechos do documento, transmite a resposta e salva citações verificadas", async () => {
    state.provider = fakeProvider();
    const before = await countUsage("ai_chat_message");
    const { events, saved } = await runTurn("Onde ocorre a fase clara?");
    expect(events.map((e) => e.type)).toEqual(["meta", "thinking", "delta", "delta", "done"]);
    const done = events.at(-1);
    expect(done?.type === "done" && done.citations.map((c) => c.fileId)).toEqual([fileId]);
    expect(saved[0]).toMatchObject({ status: "complete", content: "A fase clara ocorre nos tilacoides [1].", input_tokens: 120 });

    // O modelo recebeu as fontes isoladas e o prompt pedindo citação.
    expect(state.lastChat?.system).toContain("cite o número");
    const last = state.lastChat?.messages.at(-1);
    const text = Array.isArray(last?.content) ? last.content.map((p) => (p.type === "text" ? p.text : "")).join("\n") : last?.content;
    expect(text).toContain('<fonte n="1"');
    expect(text).toContain("tilacoides");
    expect(await countUsage("ai_chat_message")).toBe(before + 1);
  });

  it("tutor: resposta interrompida fica salva como cancelada, sem estorno", async () => {
    const { AIError } = await import("@/lib/ai/types");
    state.provider = fakeProvider({
      async *streamChat(): AsyncIterable<StreamEvent> {
        yield { type: "text", text: "Resposta pela met" };
        throw new AIError("cancelled");
      },
    });
    const before = await countUsage("ai_chat_message");
    const { events, saved } = await runTurn("Explique o ciclo de Calvin");
    expect(events.at(-1)?.type).toBe("done");
    expect(saved[0]).toMatchObject({ status: "cancelled", content: "Resposta pela met" });
    expect(await countUsage("ai_chat_message")).toBe(before + 1);
  });

  it("tutor: falha do provedor antes de qualquer texto devolve o crédito", async () => {
    const { AIError } = await import("@/lib/ai/types");
    state.provider = fakeProvider({
      async *streamChat(): AsyncIterable<StreamEvent> {
        throw new AIError("overloaded");
      },
    });
    const before = await countUsage("ai_chat_message");
    const { events, saved } = await runTurn("Pergunta qualquer");
    expect(events.at(-1)).toMatchObject({ type: "error", code: "overloaded" });
    expect(saved[0]).toMatchObject({ status: "error", error_code: "overloaded", content: "" });
    expect(await countUsage("ai_chat_message")).toBe(before);
  });

  it("tutor: bloqueia quando o limite diário do plano acaba", async () => {
    const { plans, usagePeriodKey } = await import("@/lib/config/plans");
    const { localDateString } = await import("@/lib/domain/dates");
    const used = await countUsage("ai_chat_message");
    const missing = plans.free.limits.ai_chat_message.limit - used;
    const periodKey = usagePeriodKey("day", localDateString("America/Sao_Paulo"));
    await admin
      .from("usage_records")
      .insert(Array.from({ length: missing }, () => ({ user_id: user.id, feature: "ai_chat_message", period_key: periodKey })));
    state.provider = fakeProvider();
    const { events, saved } = await runTurn("Mais uma pergunta");
    expect(events.map((e) => e.type)).toEqual(["meta", "error"]);
    expect(events[1]).toMatchObject({ code: "limit_reached" });
    expect(saved).toHaveLength(0);
  });

  it("estúdio: gera quiz, confere o gabarito e salva conteúdo + Markdown", async () => {
    const { runGeneration } = await import("@/lib/ai/studio/generate");
    const { getReadyFiles } = await import("@/lib/data/files");
    const { plans } = await import("@/lib/config/plans");
    state.provider = fakeProvider({
      async generateObject<T>(request: ObjectRequest<T>) {
        state.lastObject = request as ObjectRequest<unknown>;
        const data = {
          title: "Quiz de fotossíntese",
          questions: [
            {
              type: "multiple_choice",
              prompt: "Onde ocorre a fase clara?",
              options: ["Tilacoides", "Estroma", "Núcleo", "Ribossomo"],
              correctOption: 0,
              correctBoolean: null,
              expectedAnswer: "",
              explanation: "Nos tilacoides, onde está a clorofila.",
              difficulty: "easy",
              topic: "Fotossíntese",
            },
            {
              type: "multiple_choice",
              prompt: "Questão sem gabarito válido",
              options: ["a", "b"],
              correctOption: 5,
              correctBoolean: null,
              expectedAnswer: "",
              explanation: "",
              difficulty: "easy",
              topic: "x",
            },
          ],
        };
        return { data: data as T, usage, model: "modelo-teste" };
      },
    });
    const stages: string[] = [];
    const files = await getReadyFiles([fileId]);
    const result = await runGeneration({
      userId: user.id,
      plan: plans.free,
      timezone: "America/Sao_Paulo",
      learner,
      kind: "quiz",
      files,
      options: { difficulty: "medium", length: "medium", count: 10, focus: null, examStyle: "school", allowOpen: true },
      title: null,
      folderId: null,
      subjectId: null,
      signal: new AbortController().signal,
      onStage: (s) => stages.push(s.stage),
    });
    expect(result.ok).toBe(true);
    expect(stages).toEqual(["reading", "generating", "saving"]);
    expect(String(state.lastObject?.prompt)).toContain("<material>");
    const { data: row } = await user.client.from("ai_generations").select("*").eq("id", result.ok ? result.id : "").single();
    expect(row).toMatchObject({ status: "completed", title: "Quiz de fotossíntese", input_tokens: 120 });
    const content = row!.content as { questions: unknown[] };
    expect(content.questions).toHaveLength(1);
    expect(row!.content_markdown).toContain("## Gabarito comentado");
    const { data: links } = await user.client.from("ai_generation_sources").select("file_id").eq("generation_id", row!.id);
    expect(links).toEqual([{ file_id: fileId }]);
  });

  it("estúdio: saída inválida marca a geração como falha e devolve o crédito", async () => {
    const { runGeneration } = await import("@/lib/ai/studio/generate");
    const { getReadyFiles } = await import("@/lib/data/files");
    const { plans } = await import("@/lib/config/plans");
    const { AIError } = await import("@/lib/ai/types");
    state.provider = fakeProvider({
      async generateObject() {
        throw new AIError("invalid_output");
      },
    });
    const before = await countUsage("ai_generation");
    const result = await runGeneration({
      userId: user.id,
      plan: plans.free,
      timezone: "America/Sao_Paulo",
      learner,
      kind: "flashcards",
      files: await getReadyFiles([fileId]),
      options: { difficulty: "medium", length: "medium", count: 10, focus: null, examStyle: "school", allowOpen: true },
      title: "Cartões",
      folderId: null,
      subjectId: null,
      signal: new AbortController().signal,
      onStage: () => undefined,
    });
    expect(result).toMatchObject({ ok: false, code: "invalid_output" });
    expect(await countUsage("ai_generation")).toBe(before);
    const { data: row } = await user.client.from("ai_generations").select("status, error_message").eq("id", result.ok ? "" : result.id!).single();
    expect(row?.status).toBe("failed");
    expect(row?.error_message).toBeTruthy();
  });

  it("estúdio: material extenso é condensado em partes antes da geração", async () => {
    const { runGeneration } = await import("@/lib/ai/studio/generate");
    const { getReadyFiles } = await import("@/lib/data/files");
    const { plans } = await import("@/lib/config/plans");
    // Arquivo grande: 60 trechos de ~2.000 caracteres (acima do limite de geração direta).
    const big = await uploadRaw("apostila.txt", new TextEncoder().encode("x"), "text/plain");
    await admin.from("uploaded_files").update({ status: "ready", char_count: 120_000, chunk_count: 60 }).eq("id", big.id);
    await admin.from("document_chunks").insert(
      Array.from({ length: 60 }, (_, i) => ({
        file_id: big.id,
        user_id: user.id,
        chunk_index: i,
        content: `Trecho ${i}: ${"conteúdo de estudo ".repeat(105)}`,
        token_estimate: 550,
      })),
    );
    state.textCalls = [];
    state.provider = fakeProvider({
      async generateObject<T>(request: ObjectRequest<T>) {
        state.lastObject = request as ObjectRequest<unknown>;
        return { data: { title: "Glossário", terms: [{ term: "Termo", definition: "Definição." }] } as T, usage, model: "modelo-teste" };
      },
    });
    const stages: string[] = [];
    const result = await runGeneration({
      userId: user.id,
      plan: plans.free,
      timezone: "America/Sao_Paulo",
      learner,
      kind: "glossary",
      files: await getReadyFiles([big.id]),
      options: { difficulty: "medium", length: "medium", count: 20, focus: null, examStyle: "school", allowOpen: true },
      title: null,
      folderId: null,
      subjectId: null,
      signal: new AbortController().signal,
      onStage: (s) => stages.push(s.stage),
    });
    expect(result.ok).toBe(true);
    expect(stages).toContain("condensing");
    expect(state.textCalls.length).toBeGreaterThanOrEqual(3);
    expect(String(state.lastObject?.prompt)).toContain("### Parte 1");
    expect(String(state.lastObject?.prompt)).toContain("já foi condensado");
  });
});
