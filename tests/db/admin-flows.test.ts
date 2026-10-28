import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { adminClient, cleanupUsers, createTestUser, subjectId, supabaseAvailable, type Client, type TestUser } from "./helpers";

/**
 * Administração, cobrança e rotinas contra o Supabase local. A sessão do Next é
 * substituída; o papel de quem age vem sempre do banco (user_roles), como em produção.
 * Para o webhook, os valores do Stripe são de teste e a API é simulada (sem rede).
 */
const state = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_local_only";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_local_only";
  process.env.STRIPE_PRICE_PRO_MONTHLY = "price_test_pro";
  return { client: null as unknown as Client, userId: "" };
});

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => state.client }));
vi.mock("@/lib/auth/session", async () => {
  const { adminClient: admin } = await import("./helpers");
  const roles = async () => ((await admin().from("user_roles").select("role").eq("user_id", state.userId)).data ?? []).map((r) => r.role);
  return {
    requireUser: async () => ({ id: state.userId, email: null }),
    getSessionUser: async () => ({ id: state.userId, email: null }),
    getCurrentProfile: async () => (await admin().from("profiles").select("*").eq("id", state.userId).single()).data,
    getStaffRoles: roles,
    requireStaff: async (minimum: "moderator" | "admin" = "moderator") => {
      const list = await roles();
      const allowed = minimum === "admin" ? list.includes("admin") : list.includes("admin") || list.includes("moderator");
      if (!allowed) throw new Error("not_found");
      return { user: { id: state.userId, email: null }, roles: list, isAdmin: list.includes("admin") };
    },
  };
});
vi.mock("next/cache", () => ({ refresh: () => undefined, updateTag: () => undefined, revalidateTag: () => undefined, revalidatePath: () => undefined }));
vi.mock("@/lib/ai", () => ({ aiAvailability: () => ({ available: false, reason: "no_provider" }), getAIProvider: () => null, aiSupportsImages: () => false }));

const available = await supabaseAvailable();
const longText = "Conteúdo de estudo com explicação completa sobre ecologia e cadeias alimentares. ".repeat(4);

describe.skipIf(!available)("administração, cobrança e rotinas", () => {
  let author: TestUser;
  let reader: TestUser;
  let mod: TestUser;
  let boss: TestUser;
  let biologia: string;
  const admin = adminClient();

  const as = (u: TestUser) => {
    state.client = u.client;
    state.userId = u.id;
  };

  async function pendingMaterial(title: string) {
    const { data } = await admin
      .from("study_materials")
      .insert({ author_id: author.id, slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`, title, subject_id: biologia, content: longText, copyright_declared_at: new Date().toISOString() })
      .select("id")
      .single();
    await admin.from("study_materials").update({ status: "pending_review" }).eq("id", data!.id);
    return data!.id;
  }

  beforeAll(async () => {
    author = await createTestUser({ birthDate: "2002-02-02", displayName: "Autora Teste" });
    reader = await createTestUser({ birthDate: "2003-03-03", displayName: "Leitor Teste" });
    mod = await createTestUser({ birthDate: "1995-05-05", displayName: "Moderadora" });
    boss = await createTestUser({ birthDate: "1990-01-01", displayName: "Administrador" });
    await admin.from("user_roles").insert([
      { user_id: mod.id, role: "moderator" },
      { user_id: boss.id, role: "admin" },
    ]);
    biologia = await subjectId("biologia");
  });

  afterAll(async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_PRICE_PRO_MONTHLY;
    await admin.from("app_settings").update({ value: "pre" }).eq("key", "moderation_mode");
    await admin.from("app_settings").update({ value: 3 }).eq("key", "report_auto_hide_threshold");
    await cleanupUsers();
  });

  it("quem não é da equipe não executa ação administrativa", async () => {
    const { moderateMaterial, saveSettings } = await import("@/app/admin/actions");
    const id = await pendingMaterial("Cadeias alimentares");
    as(reader);
    await expect(moderateMaterial(id, "approve")).rejects.toThrow("not_found");
    as(mod);
    await expect(saveSettings({ moderation_mode: "post", report_auto_hide_threshold: 3, community_min_age_without_guardian: 16, child_age_limit: 12 })).rejects.toThrow(
      "not_found",
    );
  });

  it("aprovar publica, dá XP ao autor, avisa e audita", async () => {
    const { moderateMaterial } = await import("@/app/admin/actions");
    const id = await pendingMaterial("Ecologia básica");
    as(mod);
    expect(await moderateMaterial(id, "approve")).toMatchObject({ ok: true });
    const [{ data: material }, { data: xp }, { data: notes }, { data: logs }] = await Promise.all([
      admin.from("study_materials").select("status, published_at").eq("id", id).single(),
      admin.from("xp_transactions").select("amount").eq("user_id", author.id).eq("source_id", id),
      admin.from("notifications").select("type").eq("user_id", author.id).eq("type", "material_published"),
      admin.from("admin_audit_logs").select("action, actor_id").eq("target_id", id),
    ]);
    expect(material?.status).toBe("published");
    expect(xp).toEqual([{ amount: 25 }]);
    expect(notes?.length).toBeGreaterThanOrEqual(1);
    expect(logs).toEqual([{ action: "material.approve", actor_id: mod.id }]);
    // Aprovar de novo não publica nem dá XP outra vez.
    expect(await moderateMaterial(id, "approve")).toMatchObject({ ok: false });
  });

  it("moderador não aprova o próprio material; ajustes e remoção exigem motivo", async () => {
    const { moderateMaterial } = await import("@/app/admin/actions");
    const { data: own } = await admin
      .from("study_materials")
      .insert({ author_id: mod.id, slug: `proprio-${Date.now()}`, title: "Material da moderadora", subject_id: biologia, content: longText })
      .select("id")
      .single();
    await admin.from("study_materials").update({ status: "pending_review" }).eq("id", own!.id);
    as(mod);
    expect(await moderateMaterial(own!.id, "approve")).toMatchObject({ ok: false });

    const id = await pendingMaterial("Fotossíntese avançada");
    expect(await moderateMaterial(id, "changes", "curto")).toMatchObject({ ok: false });
    expect(await moderateMaterial(id, "changes", "Corrija a equação da fotossíntese no segundo parágrafo.")).toMatchObject({ ok: true });
    const { data } = await admin.from("study_materials").select("status, moderation_note").eq("id", id).single();
    expect(data).toEqual({ status: "rejected", moderation_note: "Corrija a equação da fotossíntese no segundo parágrafo." });
  });

  it("denúncias: manter devolve ao ar o material escondido automaticamente; remover encerra as denúncias", async () => {
    const { resolveMaterialReports } = await import("@/app/admin/actions");
    const keepId = await pendingMaterial("Material denunciado à toa");
    await admin.from("study_materials").update({ status: "published", published_at: new Date().toISOString() }).eq("id", keepId);
    await admin.from("app_settings").update({ value: 1 }).eq("key", "report_auto_hide_threshold");
    await reader.client.from("material_reports").insert({ material_id: keepId, reporter_id: reader.id, reason: "spam" });
    expect((await admin.from("study_materials").select("status").eq("id", keepId).single()).data?.status).toBe("pending_review");
    as(mod);
    expect(await resolveMaterialReports(keepId, "keep")).toMatchObject({ ok: true });
    expect((await admin.from("study_materials").select("status").eq("id", keepId).single()).data?.status).toBe("published");
    expect((await admin.from("material_reports").select("status").eq("material_id", keepId).single()).data?.status).toBe("resolved_kept");

    const removeId = await pendingMaterial("Cópia de apostila");
    await admin.from("study_materials").update({ status: "published" }).eq("id", removeId);
    await admin.from("app_settings").update({ value: 3 }).eq("key", "report_auto_hide_threshold");
    await reader.client.from("material_reports").insert({ material_id: removeId, reporter_id: reader.id, reason: "copyright" });
    expect(await resolveMaterialReports(removeId, "remove", "Cópia integral de apostila comercial.")).toMatchObject({ ok: true });
    expect((await admin.from("study_materials").select("status").eq("id", removeId).single()).data?.status).toBe("removed");
    expect((await admin.from("material_reports").select("status").eq("material_id", removeId).single()).data?.status).toBe("resolved_removed");
  });

  it("suspender bloqueia o acesso; moderador não suspende a equipe; papéis só por admin", async () => {
    const { setAccountSuspended, setStaffRole } = await import("@/app/admin/actions");
    as(mod);
    expect(await setAccountSuspended(boss.id, true, "Tentativa de suspender o admin.")).toMatchObject({ ok: false });
    expect(await setAccountSuspended(mod.id, true, "Suspender a si mesma não pode.")).toMatchObject({ ok: false });
    expect(await setAccountSuspended(reader.id, true, "Spam repetido na biblioteca.")).toMatchObject({ ok: true });
    const { data: profile } = await admin.from("profiles").select("account_status").eq("id", reader.id).single();
    expect(profile?.account_status).toBe("suspended");
    const { data: authUser } = await admin.auth.admin.getUserById(reader.id);
    expect(authUser.user?.banned_until).toBeTruthy();
    expect(await setAccountSuspended(reader.id, false, "Revisão do caso concluída.")).toMatchObject({ ok: true });
    expect((await admin.from("profiles").select("account_status").eq("id", reader.id).single()).data?.account_status).toBe("active");

    await expect(setStaffRole(reader.id, "moderator", true)).rejects.toThrow("not_found");
    as(boss);
    expect(await setStaffRole(reader.id, "moderator", true)).toMatchObject({ ok: true });
    expect(await setStaffRole(boss.id, "admin", false)).toMatchObject({ ok: false });
    expect(await setStaffRole(reader.id, "moderator", false)).toMatchObject({ ok: true });
  });

  it("Pro de cortesia muda o plano efetivo e pode ser encerrado", async () => {
    const { grantManualPro, revokeManualPro } = await import("@/app/admin/actions");
    const { getPlanForUser } = await import("@/lib/billing/entitlements");
    as(boss);
    expect(await grantManualPro(author.id, 30, "Bolsa do programa de parceria com a escola.")).toMatchObject({ ok: true });
    as(author);
    expect((await getPlanForUser(author.id)).id).toBe("pro");
    const { data: sub } = await admin.from("subscriptions").select("id").eq("user_id", author.id).eq("provider", "manual").single();
    as(boss);
    expect(await revokeManualPro(sub!.id)).toMatchObject({ ok: true });
  });

  it("configurações validam limites e ficam na auditoria", async () => {
    const { saveSettings } = await import("@/app/admin/actions");
    as(boss);
    expect(await saveSettings({ moderation_mode: "pre", report_auto_hide_threshold: 3, community_min_age_without_guardian: 13, child_age_limit: 15 })).toMatchObject({ ok: false });
    expect(await saveSettings({ moderation_mode: "post", report_auto_hide_threshold: 4, community_min_age_without_guardian: 16, child_age_limit: 12 })).toMatchObject({ ok: true });
    const { data } = await admin.from("app_settings").select("key, value").in("key", ["moderation_mode", "report_auto_hide_threshold"]);
    expect(Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))).toEqual({ moderation_mode: "post", report_auto_hide_threshold: 4 });
    const { data: log } = await admin.from("admin_audit_logs").select("details").eq("action", "settings.update").eq("actor_id", boss.id).single();
    expect((log?.details as { after: { moderation_mode: string } }).after.moderation_mode).toBe("post");
  });

  it("busca de usuários com e-mail só pela chave do servidor", async () => {
    const { error } = await reader.client.rpc("admin_find_users", { p_query: "teste" });
    expect(error).not.toBeNull();
    const { data } = await admin.rpc("admin_find_users", { p_query: reader.email });
    expect(data?.[0]?.id).toBe(reader.id);
  });

  it("webhook do Stripe: assinatura obrigatória, ativa o Pro e processa cada evento uma vez", async () => {
    const billing = await import("@/lib/billing/stripe");
    const stripe = billing.getStripe()!;
    expect(stripe).not.toBeNull();
    const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86400;
    vi.spyOn(stripe.subscriptions, "retrieve").mockResolvedValue({
      id: "sub_test_local",
      object: "subscription",
      status: "active",
      customer: "cus_test_local",
      metadata: { user_id: reader.id },
      cancel_at_period_end: false,
      canceled_at: null,
      items: { object: "list", data: [{ price: { id: "price_test_pro" }, current_period_start: periodEnd - 30 * 86400, current_period_end: periodEnd }] },
    } as never);
    const { POST } = await import("@/app/api/billing/webhook/route");
    const payload = JSON.stringify({ id: `evt_test_${Date.now()}`, object: "event", type: "customer.subscription.created", data: { object: { id: "sub_test_local", object: "subscription" } } });
    const header = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret: "whsec_test_local_only" });

    const bad = await POST(new Request("http://localhost/api/billing/webhook", { method: "POST", body: payload, headers: { "stripe-signature": "t=1,v1=errada" } }));
    expect(bad.status).toBe(400);
    const ok = await POST(new Request("http://localhost/api/billing/webhook", { method: "POST", body: payload, headers: { "stripe-signature": header } }));
    expect(ok.status).toBe(200);
    const again = await POST(new Request("http://localhost/api/billing/webhook", { method: "POST", body: payload, headers: { "stripe-signature": header } }));
    expect(await again.json()).toMatchObject({ duplicate: true });

    const { data: sub } = await admin.from("subscriptions").select("plan_id, status, provider").eq("provider_subscription_id", "sub_test_local").single();
    expect(sub).toEqual({ plan_id: "pro", status: "active", provider: "stripe" });
    as(reader);
    const { getPlanForUser } = await import("@/lib/billing/entitlements");
    expect((await getPlanForUser(reader.id)).id).toBe("pro");
  });

  it("lembrete do calendário chega uma vez no app", async () => {
    const { sendCalendarReminders } = await import("@/lib/jobs/reminders");
    const now = new Date();
    const starts = new Date(now.getTime() + 20 * 60_000);
    await admin.from("calendar_events").insert({
      user_id: author.id,
      title: "Prova de Biologia",
      event_type: "exam",
      starts_at: starts.toISOString(),
      ends_at: new Date(starts.getTime() + 3_600_000).toISOString(),
      reminder_minutes: 30,
    });
    const first = await sendCalendarReminders(now);
    expect(first.inApp).toBeGreaterThanOrEqual(1);
    await sendCalendarReminders(now);
    const { data } = await admin.from("notifications").select("id").eq("user_id", author.id).eq("type", "calendar_reminder");
    expect(data).toHaveLength(1);
  });

  it("limpeza remove envios abandonados e mantém os recentes", async () => {
    const old = `${author.id}/abandonado-${Date.now()}.pdf`;
    const fresh = `${author.id}/recente-${Date.now()}.pdf`;
    // Inserções separadas: num lote, o campo ausente iria como null (e o lote falharia).
    const base = { user_id: author.id, original_name: "arquivo.pdf", mime_type: "application/pdf", size_bytes: 10, status: "pending_upload" as const };
    expect((await admin.from("uploaded_files").insert({ ...base, storage_path: old, created_at: new Date(Date.now() - 3 * 86_400_000).toISOString() })).error).toBeNull();
    expect((await admin.from("uploaded_files").insert({ ...base, storage_path: fresh })).error).toBeNull();
    const { runCleanup } = await import("@/lib/jobs/maintenance");
    const result = await runCleanup();
    expect(result.orphanFiles).toBeGreaterThanOrEqual(1);
    const { data } = await admin.from("uploaded_files").select("storage_path").in("storage_path", [old, fresh]);
    expect(data).toEqual([{ storage_path: fresh }]);
  });
});
