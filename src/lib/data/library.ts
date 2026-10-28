import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { materialTypeLabels, schoolStageLabels, type MaterialType, type SchoolStage } from "@/lib/config/subjects";
import { acceptedMimeTypes, type AcceptedMimeType, type UploadKind } from "@/lib/config/uploads";
import { getSubjects } from "@/lib/data/subjects";
import { isSupabaseConfigured } from "@/lib/env/public";
import { isServiceRoleConfigured } from "@/lib/env/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const PAGE_SIZE = 24;

export const sortOptions = {
  relevancia: { value: "relevance", label: "Mais relevantes" },
  recentes: { value: "recent", label: "Mais recentes" },
  salvos: { value: "saves", label: "Mais salvos" },
  vistos: { value: "views", label: "Mais vistos" },
  avaliados: { value: "rating", label: "Mais bem avaliados" },
} as const;

export type SortKey = keyof typeof sortOptions;

export type LibraryFilters = {
  q: string;
  subjectSlug: string | null;
  stage: SchoolStage | null;
  grade: number | null;
  type: MaterialType | null;
  topic: string;
  sort: SortKey;
  page: number;
};

type Params = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** Lê e valida os filtros da URL (valores desconhecidos são ignorados). */
export function parseLibraryFilters(params: Params): LibraryFilters {
  const stage = one(params.etapa);
  const type = one(params.tipo);
  const sort = one(params.ordem);
  const grade = Number.parseInt(one(params.serie), 10);
  const page = Number.parseInt(one(params.pagina), 10);
  return {
    q: one(params.q).slice(0, 120),
    subjectSlug: /^[a-z0-9-]{2,40}$/.test(one(params.materia)) ? one(params.materia) : null,
    stage: stage in schoolStageLabels ? (stage as SchoolStage) : null,
    grade: Number.isInteger(grade) && grade >= 1 && grade <= 9 ? grade : null,
    type: type in materialTypeLabels ? (type as MaterialType) : null,
    topic: one(params.tema).slice(0, 80),
    sort: sort in sortOptions ? (sort as SortKey) : one(params.q) ? "relevancia" : "recentes",
    page: Number.isInteger(page) && page >= 1 && page <= 200 ? page : 1,
  };
}

export function filtersToSearch(filters: Partial<LibraryFilters>): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.subjectSlug) params.set("materia", filters.subjectSlug);
  if (filters.stage) params.set("etapa", filters.stage);
  if (filters.grade) params.set("serie", String(filters.grade));
  if (filters.type) params.set("tipo", filters.type);
  if (filters.topic) params.set("tema", filters.topic);
  if (filters.sort && filters.sort !== (filters.q ? "relevancia" : "recentes")) params.set("ordem", filters.sort);
  if (filters.page && filters.page > 1) params.set("pagina", String(filters.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Valores dos campos do formulário de filtros (strings, como na URL). */
export function filterFormValues(filters: LibraryFilters) {
  return {
    q: filters.q,
    materia: filters.subjectSlug ?? "",
    etapa: filters.stage ?? "",
    serie: filters.grade ? String(filters.grade) : "",
    tipo: filters.type ?? "",
    tema: filters.topic,
    ordem: filters.sort,
  };
}

export function defaultSortFor(filters: Pick<LibraryFilters, "q">): SortKey {
  return filters.q ? "relevancia" : "recentes";
}

export const sortSelectOptions = Object.entries(sortOptions).map(([key, option]) => ({ key, label: option.label }));

export type MaterialCard = {
  id: string;
  slug: string;
  title: string;
  description: string;
  subjectId: string;
  materialType: MaterialType;
  schoolStage: SchoolStage | null;
  gradeYear: number | null;
  topic: string | null;
  author: MaterialAuthor | null;
  publishedAt: string | null;
  views: number;
  saves: number;
  rating: number | null;
  ratingCount: number;
};

export type MaterialAuthor = { username: string; displayName: string | null; avatarUrl: string | null };

/** Autores pelo cartão público: nome e foto só aparecem quando o perfil é público. */
async function authorsById(ids: string[]): Promise<Map<string, MaterialAuthor>> {
  if (!ids.length) return new Map();
  const { data } = await createSupabasePublicClient()
    .from("profile_cards")
    .select("id, username, display_name, avatar_url")
    .in("id", [...new Set(ids)]);
  return new Map((data ?? []).map((a) => [a.id!, { username: a.username!, displayName: a.display_name, avatarUrl: a.avatar_url }]));
}

export async function searchLibrary(filters: LibraryFilters): Promise<{ items: MaterialCard[]; total: number }> {
  const subjects = await getSubjects();
  const subjectId = filters.subjectSlug ? subjects.find((s) => s.slug === filters.subjectSlug)?.id : undefined;
  if (filters.subjectSlug && !subjectId) return { items: [], total: 0 };
  // Busca pública: o cliente anônimo garante que só entram materiais publicados e públicos.
  const { data } = await createSupabasePublicClient().rpc("search_materials", {
    p_query: filters.q || undefined,
    p_subject_id: subjectId,
    p_school_stage: filters.stage ?? undefined,
    p_grade_year: filters.grade ?? undefined,
    p_material_type: filters.type ?? undefined,
    p_topic: filters.topic || undefined,
    p_sort: sortOptions[filters.sort].value,
    p_limit: PAGE_SIZE,
    p_offset: (filters.page - 1) * PAGE_SIZE,
  });
  const rows = data ?? [];
  const authors = await authorsById(rows.map((r) => r.author_id));
  return {
    total: Number(rows[0]?.total_count ?? 0),
    items: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description,
      subjectId: r.subject_id,
      materialType: r.material_type,
      schoolStage: r.school_stage,
      gradeYear: r.grade_year,
      topic: r.topic,
      author: authors.get(r.author_id) ?? null,
      publishedAt: r.published_at,
      views: r.views_count,
      saves: r.saves_count + r.favorites_count,
      rating: r.rating_count ? Math.round((r.rating_sum / r.rating_count) * 10) / 10 : null,
      ratingCount: r.rating_count,
    })),
  };
}

export type MaterialRow = Database["public"]["Tables"]["study_materials"]["Row"];

function toCard(row: MaterialRow, author: MaterialAuthor | null): MaterialCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    subjectId: row.subject_id,
    materialType: row.material_type,
    schoolStage: row.school_stage,
    gradeYear: row.grade_year,
    topic: row.topic,
    author,
    publishedAt: row.published_at,
    views: row.views_count,
    saves: row.saves_count + row.favorites_count,
    rating: row.rating_count ? Math.round((row.rating_sum / row.rating_count) * 10) / 10 : null,
    ratingCount: row.rating_count,
  };
}

/** Cartões a partir de linhas completas de materiais (com os autores). */
export async function toCardFromRow(rows: MaterialRow[]): Promise<MaterialCard[]> {
  const authors = await authorsById(rows.map((r) => r.author_id));
  return rows.map((r) => toCard(r, authors.get(r.author_id) ?? null));
}

/** Material pela URL. O RLS decide: publicado (público ou por link), do próprio autor ou para a moderação. */
export async function getVisibleMaterial(slug: string): Promise<MaterialRow | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 120) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("study_materials").select("*").eq("slug", slug).maybeSingle();
  return data;
}

export async function getMaterialBySlug(slug: string) {
  const material = await getVisibleMaterial(slug);
  if (!material) return null;
  const [authors, { data: related }, attachment] = await Promise.all([
    authorsById([material.author_id]),
    createSupabasePublicClient().rpc("related_materials", { p_material_id: material.id, p_limit: 6 }),
    getAttachment(material),
  ]);
  const relatedRows = (related ?? []) as MaterialRow[];
  const relatedAuthors = await authorsById(relatedRows.map((r) => r.author_id));
  return {
    material,
    author: authors.get(material.author_id) ?? null,
    attachment,
    related: relatedRows.map((r) => toCard(r, relatedAuthors.get(r.author_id) ?? null)),
  };
}

export type MaterialAttachment = { name: string; kind: UploadKind; sizeBytes: number; pageCount: number | null };

/**
 * Metadados do arquivo anexado. O arquivo pertence ao autor (o RLS de quem lê não o
 * alcança), então a leitura usa a chave do servidor, só depois de o material estar visível.
 */
async function getAttachment(material: Pick<MaterialRow, "file_id" | "author_id">): Promise<MaterialAttachment | null> {
  if (!material.file_id || !isServiceRoleConfigured()) return null;
  const { data: file } = await createSupabaseAdminClient()
    .from("uploaded_files")
    .select("original_name, mime_type, size_bytes, page_count, status")
    .eq("id", material.file_id)
    .eq("user_id", material.author_id)
    .maybeSingle();
  if (!file || file.status !== "ready") return null;
  return {
    name: file.original_name,
    kind: acceptedMimeTypes[file.mime_type as AcceptedMimeType]?.kind ?? "text",
    sizeBytes: file.size_bytes,
    pageCount: file.page_count,
  };
}

export async function getViewerState(materialId: string, userId: string) {
  const supabase = await createSupabaseServerClient();
  const [{ data: saves }, { data: rating }, { data: report }] = await Promise.all([
    supabase.from("material_saves").select("kind").eq("material_id", materialId).eq("user_id", userId),
    supabase.from("material_ratings").select("value").eq("material_id", materialId).eq("user_id", userId).maybeSingle(),
    supabase.from("material_reports").select("id").eq("material_id", materialId).eq("reporter_id", userId).eq("status", "open").maybeSingle(),
  ]);
  const kinds = new Set((saves ?? []).map((s) => s.kind));
  return { favorite: kinds.has("favorite"), saved: kinds.has("saved"), rating: rating?.value ?? null, reported: Boolean(report) };
}

/** Itens salvos ou favoritados (biblioteca pessoal). */
export async function listSavedMaterials(kind: "saved" | "favorite"): Promise<(MaterialCard & { folderId: string | null })[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("material_saves")
    .select("folder_id, created_at, study_materials(*)")
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []).filter((r) => r.study_materials);
  const authors = await authorsById(rows.map((r) => r.study_materials!.author_id));
  return rows.map((r) => ({ ...toCard(r.study_materials!, authors.get(r.study_materials!.author_id) ?? null), folderId: r.folder_id }));
}

export async function listMaterialsByAuthor(authorId: string, limit = 30): Promise<MaterialCard[]> {
  const { data } = await createSupabasePublicClient()
    .from("study_materials")
    .select("*")
    .eq("author_id", authorId)
    .eq("status", "published")
    .eq("visibility", "public")
    .order("published_at", { ascending: false })
    .limit(limit);
  const authors = await authorsById([authorId]);
  return (data ?? []).map((r) => toCard(r, authors.get(authorId) ?? null));
}

/** Materiais do próprio autor (o filtro por autor é obrigatório: o RLS também libera os publicados de todos). */
export async function listMyMaterials(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("study_materials")
    .select("id, slug, title, status, visibility, subject_id, material_type, moderation_note, views_count, saves_count, favorites_count, rating_sum, rating_count, updated_at, published_at")
    .eq("author_id", userId)
    .order("updated_at", { ascending: false })
    .limit(200);
  return data ?? [];
}

/** Material do próprio autor para edição. */
export async function getMyMaterial(id: string, userId: string): Promise<MaterialRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("study_materials").select("*").eq("id", id).eq("author_id", userId).maybeSingle();
  return data;
}

export type MaterialEvent = { id: number; event: string; toStatus: string; note: string | null; createdAt: string };

export async function listMaterialEvents(materialId: string): Promise<MaterialEvent[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("material_events")
    .select("id, event, to_status, note, created_at")
    .eq("material_id", materialId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);
  return (data ?? []).map((e) => ({ id: e.id, event: e.event, toStatus: e.to_status, note: e.note, createdAt: e.created_at }));
}

/** Denúncias feitas pelo próprio usuário (para acompanhar o andamento). */
export async function listMyReports(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("material_reports")
    .select("id, reason, status, created_at, resolved_at, study_materials(slug, title)")
    .eq("reporter_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((r) => ({
    id: r.id,
    reason: r.reason,
    status: r.status,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    material: r.study_materials ? { slug: r.study_materials.slug, title: r.study_materials.title } : null,
  }));
}

export type CommunitySettings = { moderationMode: "pre" | "post"; minAgeWithoutGuardian: number };

/** Regras da comunidade editáveis pela administração (leitura pública; cache invalidado pela tag "settings"). */
export async function getCommunitySettings(): Promise<CommunitySettings> {
  "use cache";
  cacheLife("minutes");
  cacheTag("settings");
  if (!isSupabaseConfigured()) return { moderationMode: "pre", minAgeWithoutGuardian: 16 };
  const { data } = await createSupabasePublicClient()
    .from("app_settings")
    .select("key, value")
    .in("key", ["moderation_mode", "community_min_age_without_guardian"]);
  const byKey = new Map((data ?? []).map((row) => [row.key, row.value]));
  const minAge = Number(byKey.get("community_min_age_without_guardian"));
  return {
    moderationMode: byKey.get("moderation_mode") === "post" ? "post" : "pre",
    minAgeWithoutGuardian: Number.isInteger(minAge) && minAge > 0 ? minAge : 16,
  };
}

function ageInYears(birthDate: string | null, today = new Date()): number | null {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  let age = today.getUTCFullYear() - y;
  if (today.getUTCMonth() + 1 < m || (today.getUTCMonth() + 1 === m && today.getUTCDate() < d)) age -= 1;
  return age;
}

/**
 * Antecipa na tela a regra que o banco aplica em submit_material: publicar exige a
 * idade mínima ou o consentimento de um responsável.
 */
export async function getPublishEligibility(profile: { id: string; birth_date: string | null }) {
  const settings = await getCommunitySettings();
  const age = ageInYears(profile.birth_date);
  if (age !== null && age >= settings.minAgeWithoutGuardian) return { allowed: true, settings } as const;
  const supabase = await createSupabaseServerClient();
  const { data: consent } = await supabase.rpc("has_guardian_consent", { p_user_id: profile.id });
  return { allowed: consent === true, settings } as const;
}
