import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { supabaseAvailable } from "./helpers";

/**
 * Revisão de segurança automatizada do esquema, contra o banco local com todas as
 * migrações aplicadas. Falha quando uma mudança abre uma brecha comum: tabela sem RLS,
 * função privilegiada sem search_path fixo ou exposta a clientes sem revisão, view que
 * ignora a RLS, escrita de cliente em tabela ou coluna que só o servidor altera.
 *
 * As listas abaixo são a revisão registrada: mexer nelas exige justificar ao lado.
 */
const dbUrl = process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres"; // padrão do `supabase start`

/** SECURITY DEFINER que visitantes (anon) podem chamar. */
const definerForVisitors: Record<string, string> = {
  is_admin: "usada nas políticas de RLS; só responde sobre quem chama (falso para visitantes)",
  is_moderator: "idem",
  setting_int: "lê configurações não sensíveis (idades mínimas e limiares de moderação)",
  setting_text: "idem",
  get_public_profile: "devolve só o que a pessoa deixou público",
  search_profiles: "busca só perfis públicos ou com materiais publicados",
};

/** SECURITY DEFINER que pessoas logadas podem chamar; todas filtram por auth.uid() por dentro. */
const definerForMembers: Record<string, string> = {
  can_answer_attempt: "políticas de quiz_answers: tentativa da própria pessoa, em andamento e no prazo",
  submit_material: "envia para revisão um material da própria pessoa",
  withdraw_material: "retira da revisão um material da própria pessoa",
  apply_flashcard_review: "grava a revisão de um cartão da própria pessoa, com controle de concorrência",
  submit_quiz_attempt: "entrega a tentativa da própria pessoa; a nota é calculada no banco",
  get_league_leaderboard: "ranking da liga de quem chama; esconde quem pediu para não aparecer",
  my_achievements: "conquistas de quem chama",
  my_league_status: "situação de quem chama na liga",
};

/** Views que rodam com o dono (ignoram a RLS) de propósito. */
const definerViews: Record<string, string> = {
  profile_cards: "cartão de perfil: mascara nome, foto e bio de perfis privados e só lista contas ativas",
};

/** Tabelas que só o servidor altera: nenhum privilégio nem política de escrita para clientes. */
const serverOnlyTables = [
  "achievements",
  "admin_audit_logs",
  "app_settings",
  "billing_customers",
  "billing_events",
  "contact_messages",
  "document_chunks",
  "flashcard_reviews",
  "focus_timers",
  "guardian_consents",
  "leaderboard_entries",
  "league_rollovers",
  "material_events",
  "material_views",
  "rate_limits",
  "reminder_deliveries",
  "study_sessions",
  "subjects",
  "subscriptions",
  "usage_records",
  "user_achievements",
  "user_roles",
  "user_stats",
  "xp_transactions",
];

/** Colunas que clientes nunca escrevem, mesmo em tabelas que podem alterar. */
const protectedColumns: Array<[table: string, privilege: "INSERT" | "UPDATE", columns: string[]]> = [
  ["profiles", "UPDATE", ["id", "account_status", "created_at"]],
  ["study_materials", "INSERT", ["status", "published_at", "moderation_note", "views_count", "favorites_count", "saves_count", "rating_sum", "rating_count"]],
  [
    "study_materials",
    "UPDATE",
    ["author_id", "slug", "status", "published_at", "moderation_note", "views_count", "favorites_count", "saves_count", "rating_sum", "rating_count"],
  ],
  ["quiz_attempts", "INSERT", ["status", "deadline_at", "submitted_at", "graded_at", "score", "max_score", "correct_count", "total_count"]],
  ["quiz_attempts", "UPDATE", ["quiz_id", "user_id", "status", "deadline_at", "submitted_at", "graded_at", "score", "max_score", "correct_count", "total_count"]],
  ["quiz_answers", "INSERT", ["is_correct", "score", "feedback"]],
  ["quiz_answers", "UPDATE", ["attempt_id", "question_id", "user_id", "is_correct", "score", "feedback"]],
  ["material_reports", "INSERT", ["status", "resolved_by", "resolved_at", "resolution_note"]],
  ["material_reports", "UPDATE", ["status", "resolved_by", "resolved_at", "resolution_note", "reporter_id"]],
  ["uploaded_files", "UPDATE", ["user_id", "bucket", "storage_path", "mime_type", "size_bytes", "sha256", "status"]],
  ["notifications", "UPDATE", ["user_id", "type", "title", "body", "link"]],
  ["material_ratings", "UPDATE", ["user_id", "material_id"]],
  ["material_saves", "UPDATE", ["user_id", "material_id"]],
];

const clientRoles = ["anon", "authenticated"] as const;
const available = await supabaseAvailable();

describe.skipIf(!available)("revisão de segurança do esquema", () => {
  const sql = postgres(dbUrl, { max: 1, onnotice: () => undefined });
  afterAll(() => sql.end());

  it("toda tabela do schema public tem RLS ligada", async () => {
    const rows = await sql<{ name: string }[]>`
      select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity`;
    expect(rows.map((r) => r.name)).toEqual([]);
  });

  it("toda função do schema public fixa o search_path", async () => {
    const rows = await sql<{ name: string }[]>`
      select p.oid::regprocedure::text as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f'
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`;
    expect(rows.map((r) => r.name)).toEqual([]);
  });

  it("funções privilegiadas só ficam expostas a clientes quando revisadas", async () => {
    // Funções de gatilho não podem ser chamadas diretamente; ficam de fora.
    const rows = await sql<{ name: string; anon: boolean; member: boolean }[]>`
      select p.proname as name,
             bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')) as anon,
             bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE')) as member
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
      group by p.proname`;
    const forVisitors = rows.filter((r) => r.anon).map((r) => r.name);
    const forMembers = rows.filter((r) => r.member && !r.anon).map((r) => r.name);
    expect(forVisitors.sort()).toEqual(Object.keys(definerForVisitors).sort());
    expect(forMembers.sort()).toEqual(Object.keys(definerForMembers).sort());
  });

  it("views que ignoram a RLS são só as revisadas, e nenhuma lê auth.users", async () => {
    const rows = await sql<{ name: string; invoker: boolean; definition: string }[]>`
      select c.relname as name,
             coalesce('security_invoker=true' = any(c.reloptions) or 'security_invoker=on' = any(c.reloptions), false) as invoker,
             pg_get_viewdef(c.oid) as definition
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('v', 'm')`;
    expect(rows.filter((r) => !r.invoker).map((r) => r.name).sort()).toEqual(Object.keys(definerViews).sort());
    expect(rows.filter((r) => /\bauth\.users\b/.test(r.definition)).map((r) => r.name)).toEqual([]);
  });

  it("visitantes não escrevem em nenhuma tabela e ninguém de fora tem TRUNCATE", async () => {
    const rows = await sql<{ name: string; role: string }[]>`
      select c.relname as name, r.role
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      cross join unnest(${sql.array([...clientRoles])}::text[]) as r(role)
      where n.nspname = 'public' and c.relkind in ('r', 'p', 'v')
        and (has_table_privilege(r.role, c.oid, 'TRUNCATE')
             or (r.role = 'anon' and (has_any_column_privilege(r.role, c.oid, 'INSERT')
                                      or has_any_column_privilege(r.role, c.oid, 'UPDATE')
                                      or has_table_privilege(r.role, c.oid, 'DELETE'))))`;
    expect(rows).toEqual([]);
  });

  it("tabelas do servidor não aceitam escrita de clientes, nem por privilégio nem por política", async () => {
    const grants = await sql<{ name: string; role: string }[]>`
      select c.relname as name, r.role
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      cross join unnest(${sql.array([...clientRoles])}::text[]) as r(role)
      where n.nspname = 'public' and c.relname = any(${sql.array(serverOnlyTables)}::text[])
        and (has_any_column_privilege(r.role, c.oid, 'INSERT')
             or has_any_column_privilege(r.role, c.oid, 'UPDATE')
             or has_table_privilege(r.role, c.oid, 'DELETE'))`;
    expect(grants).toEqual([]);

    const policies = await sql<{ table: string; policy: string }[]>`
      select tablename as table, policyname as policy from pg_policies
      where schemaname = 'public' and tablename = any(${sql.array(serverOnlyTables)}::text[])
        and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')`;
    expect(policies).toEqual([]);

    // A lista precisa existir de verdade: um nome errado aqui esconderia uma tabela.
    const existing = await sql<{ name: string }[]>`
      select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = any(${sql.array(serverOnlyTables)}::text[])`;
    expect(existing.map((r) => r.name).sort()).toEqual([...serverOnlyTables].sort());
  });

  it("nenhuma política de escrita libera tudo (USING/WITH CHECK literal true)", async () => {
    const rows = await sql<{ table: string; policy: string }[]>`
      select tablename as table, policyname as policy from pg_policies
      where schemaname = 'public' and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
        and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true')`;
    expect(rows).toEqual([]);
  });

  it("colunas sensíveis não são graváveis por clientes", async () => {
    const leaks: string[] = [];
    for (const [table, privilege, columns] of protectedColumns) {
      for (const column of columns) {
        for (const role of clientRoles) {
          const [row] = await sql<{ allowed: boolean }[]>`
            select has_column_privilege(${role}, ${`public.${table}`}::regclass, ${column}, ${privilege}) as allowed`;
          if (row!.allowed) leaks.push(`${role} ${privilege} ${table}.${column}`);
        }
      }
    }
    expect(leaks).toEqual([]);
  });

  it("só o bucket de avatares é público", async () => {
    const rows = await sql<{ id: string }[]>`select id from storage.buckets where public order by id`;
    expect(rows.map((r) => r.id)).toEqual(["avatars"]);
  });
});
