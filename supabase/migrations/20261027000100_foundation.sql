-- Grifo — fundação do banco: extensões, tipos, utilitários e configuração de busca.
--
-- Convenções usadas em todas as migrações:
--   * IDs uuid com gen_random_uuid(); created_at/updated_at em timestamptz.
--   * Toda tabela do schema public tem RLS ligado. Tabelas sem policy só são
--     acessíveis pelo service_role (código de servidor).
--   * Tabelas filhas carregam user_id e usam FKs compostas (id, user_id) para
--     garantir que o filho pertence ao mesmo dono do pai.
--   * Funções security definer fixam search_path = '' e qualificam nomes.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Busca em português sem acentos: "funcao" encontra "função".
do $$
begin
  if not exists (select 1 from pg_ts_config where cfgname = 'portuguese_unaccent') then
    create text search configuration public.portuguese_unaccent (copy = pg_catalog.portuguese);
    alter text search configuration public.portuguese_unaccent
      alter mapping for hword, hword_part, word with extensions.unaccent, portuguese_stem;
  end if;
end
$$;

create or replace function public.immutable_unaccent(value text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, value);
$$;

-- Tipos enumerados ------------------------------------------------------------

create type public.school_stage as enum (
  'fundamental_1', 'fundamental_2', 'medio', 'pre_vestibular', 'superior', 'outro'
);
create type public.app_role as enum ('admin', 'moderator');
create type public.account_status as enum ('active', 'pending_guardian', 'suspended');
create type public.consent_status as enum ('pending', 'granted', 'revoked', 'expired');
create type public.material_type as enum (
  'summary', 'mind_map', 'exercise_list', 'notes', 'presentation', 'flashcards', 'essay', 'other'
);
create type public.material_status as enum ('draft', 'pending_review', 'published', 'rejected', 'removed');
create type public.visibility as enum ('public', 'unlisted', 'private');
create type public.report_reason as enum (
  'copyright', 'inappropriate', 'spam', 'incorrect', 'personal_data', 'harassment', 'other'
);
create type public.report_status as enum ('open', 'resolved_removed', 'resolved_kept', 'dismissed');
create type public.file_status as enum ('pending_upload', 'processing', 'ready', 'failed');
create type public.generation_kind as enum (
  'summary_quick', 'summary_detailed', 'study_guide', 'key_concepts', 'glossary',
  'flashcards', 'quiz', 'mock_exam', 'essay_questions', 'explanation'
);
create type public.generation_status as enum ('pending', 'completed', 'failed');
create type public.card_state as enum ('new', 'learning', 'review', 'relearning');
create type public.quiz_kind as enum ('quiz', 'mock_exam');
create type public.question_type as enum ('multiple_choice', 'true_false', 'open');
create type public.difficulty as enum ('easy', 'medium', 'hard');
create type public.attempt_status as enum ('in_progress', 'submitted', 'graded');
create type public.plan_status as enum ('active', 'paused', 'completed', 'archived');
create type public.task_type as enum ('study', 'summary', 'flashcards', 'quiz', 'exercises', 'mock_exam', 'review');
create type public.task_status as enum ('pending', 'done', 'skipped');
create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused'
);

-- Utilitários -------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Configurações de produto editáveis pelo painel administrativo.
create table public.app_settings (
  key text primary key check (key ~ '^[a-z0-9_]{2,64}$'),
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.app_settings enable row level security;
create policy "app_settings: leitura pública" on public.app_settings
  for select to anon, authenticated using (true);
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings (key, value, description) values
  ('moderation_mode', '"pre"', 'pre: todo material passa por revisão antes de aparecer; post: publica após validação automática e revisa por denúncia.'),
  ('report_auto_hide_threshold', '3', 'Quantidade de denúncias abertas de pessoas diferentes que tira um material do ar até a revisão.'),
  ('community_min_age_without_guardian', '16', 'Idade mínima para perfil público e publicação sem consentimento do responsável.'),
  ('child_age_limit', '12', 'Abaixo desta idade a conta só é liberada com consentimento do responsável (LGPD, art. 14).')
on conflict (key) do nothing;

create or replace function public.setting_int(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::integer from public.app_settings where key = p_key), p_default);
$$;

create or replace function public.setting_text(p_key text, p_default text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value #>> '{}' from public.app_settings where key = p_key), p_default);
$$;

-- Ninguém além do servidor escreve nada por padrão: removemos privilégios de
-- escrita do papel anônimo em tudo que for criado no schema public.
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon;
