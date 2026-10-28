import "server-only";

import { localDateString } from "@/lib/domain/dates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Consultas da área administrativa. Usam a chave do servidor (veem dados de todos),
 * então SÓ podem ser chamadas depois de requireStaff() na página ou ação.
 */
const admin = () => createSupabaseAdminClient();

const count = async (query: PromiseLike<{ count: number | null }>) => (await query).count ?? 0;

export async function adminOverview() {
  const db = admin();
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 86_400_000).toISOString();
  const today = localDateString("America/Sao_Paulo");
  const month = today.slice(0, 7);
  const [users, newUsers, activeUsers, pending, published, openReports, openContacts, proSubs, usageMonth] = await Promise.all([
    count(db.from("profiles").select("id", { count: "exact", head: true })),
    count(db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgo)),
    db.from("study_sessions").select("user_id").gte("created_at", weekAgo).limit(50_000),
    count(db.from("study_materials").select("id", { count: "exact", head: true }).eq("status", "pending_review")),
    count(db.from("study_materials").select("id", { count: "exact", head: true }).eq("status", "published")),
    count(db.from("material_reports").select("id", { count: "exact", head: true }).eq("status", "open")),
    count(db.from("contact_messages").select("id", { count: "exact", head: true }).neq("status", "closed")),
    count(db.from("subscriptions").select("id", { count: "exact", head: true }).eq("plan_id", "pro").in("status", ["active", "trialing", "past_due"])),
    db.from("usage_records").select("feature, quantity, metadata").like("period_key", `%${month}%`).limit(100_000),
  ]);
  const usageByFeature = new Map<string, { quantity: number; inputTokens: number; outputTokens: number }>();
  for (const row of usageMonth.data ?? []) {
    const entry = usageByFeature.get(row.feature) ?? { quantity: 0, inputTokens: 0, outputTokens: 0 };
    entry.quantity += row.quantity;
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    entry.inputTokens += typeof meta.input_tokens === "number" ? meta.input_tokens : 0;
    entry.outputTokens += typeof meta.output_tokens === "number" ? meta.output_tokens : 0;
    usageByFeature.set(row.feature, entry);
  }
  return {
    users,
    newUsers,
    activeUsers: new Set((activeUsers.data ?? []).map((r) => r.user_id)).size,
    pending,
    published,
    openReports,
    openContacts,
    proSubs,
    usage: [...usageByFeature.entries()].map(([feature, v]) => ({ feature, ...v })),
    month,
  };
}

async function usernames(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const { data } = await admin().from("profiles").select("id, username").in("id", [...new Set(ids)]);
  return new Map((data ?? []).map((p) => [p.id, p.username]));
}

export async function listPendingMaterials() {
  const db = admin();
  const { data } = await db
    .from("study_materials")
    .select("id, slug, title, description, content, subject_id, material_type, visibility, author_id, file_id, moderation_note, updated_at")
    .eq("status", "pending_review")
    .order("updated_at", { ascending: true })
    .limit(50);
  const rows = data ?? [];
  const ids = rows.map((r) => r.id);
  const [names, reports] = await Promise.all([
    usernames(rows.map((r) => r.author_id)),
    ids.length ? db.from("material_reports").select("material_id").eq("status", "open").in("material_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const reportCount = new Map<string, number>();
  for (const r of reports.data ?? []) reportCount.set(r.material_id, (reportCount.get(r.material_id) ?? 0) + 1);
  return rows.map((r) => ({ ...r, author: names.get(r.author_id) ?? null, openReports: reportCount.get(r.id) ?? 0 }));
}

export async function listOpenReports() {
  const db = admin();
  const { data } = await db
    .from("material_reports")
    .select("id, material_id, reporter_id, reason, details, created_at, study_materials(slug, title, status, author_id, moderation_note)")
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(200);
  const groups = new Map<
    string,
    {
      materialId: string;
      material: { slug: string; title: string; status: string; authorId: string; moderationNote: string | null } | null;
      reports: { id: string; reason: string; details: string | null; createdAt: string }[];
    }
  >();
  for (const r of data ?? []) {
    const group = groups.get(r.material_id) ?? {
      materialId: r.material_id,
      material: r.study_materials
        ? { slug: r.study_materials.slug, title: r.study_materials.title, status: r.study_materials.status, authorId: r.study_materials.author_id, moderationNote: r.study_materials.moderation_note }
        : null,
      reports: [],
    };
    group.reports.push({ id: r.id, reason: r.reason, details: r.details, createdAt: r.created_at });
    groups.set(r.material_id, group);
  }
  const list = [...groups.values()];
  const names = await usernames(list.flatMap((g) => (g.material ? [g.material.authorId] : [])));
  return list
    .map((g) => ({ ...g, author: g.material ? (names.get(g.material.authorId) ?? null) : null }))
    .sort((a, b) => b.reports.length - a.reports.length);
}

export async function findUsers(query: string) {
  const { data } = await admin().rpc("admin_find_users", { p_query: query.trim().slice(0, 80), p_limit: 50 });
  return data ?? [];
}

export async function getUserDetail(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = admin();
  const [{ data: found }, { data: subs }, materials, reportsAgainst, { data: stats }] = await Promise.all([
    db.rpc("admin_find_users", { p_query: id, p_limit: 1 }),
    db.from("subscriptions").select("id, provider, plan_id, status, current_period_end, cancel_at_period_end, created_at").eq("user_id", id).order("created_at", { ascending: false }),
    count(db.from("study_materials").select("id", { count: "exact", head: true }).eq("author_id", id)),
    db.from("material_reports").select("id, study_materials!inner(author_id)").eq("study_materials.author_id", id).limit(500),
    db.from("user_stats").select("xp_total, level, current_streak, league").eq("user_id", id).maybeSingle(),
  ]);
  const user = found?.[0];
  if (!user) return null;
  return { user, subscriptions: subs ?? [], materials, reportsAgainst: reportsAgainst.data?.length ?? 0, stats };
}

export async function listContactMessages(status: "open" | "in_progress" | "closed" | "all") {
  let query = admin()
    .from("contact_messages")
    .select("id, name, email, topic, message, reference_url, status, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status !== "all") query = query.eq("status", status);
  const { data } = await query;
  return data ?? [];
}

export async function listAuditLogs(limit = 200) {
  const { data } = await admin()
    .from("admin_audit_logs")
    .select("id, actor_id, action, target_type, target_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = data ?? [];
  const names = await usernames(rows.flatMap((r) => (r.actor_id ? [r.actor_id] : [])));
  return rows.map((r) => ({ ...r, actor: r.actor_id ? (names.get(r.actor_id) ?? null) : null }));
}

export async function listAllSubjects() {
  const { data } = await admin().from("subjects").select("id, slug, name, kind, color, icon, sort_order, is_active").order("sort_order");
  return data ?? [];
}

export async function listSettings() {
  const { data } = await admin().from("app_settings").select("key, value, description, updated_at").order("key");
  return data ?? [];
}
