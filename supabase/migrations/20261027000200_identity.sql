-- Identidade: disciplinas, perfis, preferências, papéis, consentimento de responsáveis.

-- Disciplinas e categorias -----------------------------------------------------
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 60),
  kind text not null default 'discipline' check (kind in ('discipline', 'exam_prep', 'other')),
  color text not null default 'blue' check (color ~ '^[a-z]{3,16}$'),
  icon text not null default 'book-open' check (icon ~ '^[a-z0-9-]{2,40}$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subjects enable row level security;
create policy "subjects: leitura pública das ativas" on public.subjects
  for select to anon, authenticated using (is_active);
create trigger subjects_updated_at before update on public.subjects
  for each row execute function public.set_updated_at();

insert into public.subjects (slug, name, kind, color, icon, sort_order) values
  ('matematica', 'Matemática', 'discipline', 'blue', 'sigma', 10),
  ('portugues', 'Português', 'discipline', 'rose', 'languages', 20),
  ('redacao', 'Redação', 'discipline', 'rose', 'pen-line', 25),
  ('literatura', 'Literatura', 'discipline', 'purple', 'book-open', 30),
  ('biologia', 'Biologia', 'discipline', 'green', 'leaf', 40),
  ('quimica', 'Química', 'discipline', 'teal', 'flask-conical', 50),
  ('fisica', 'Física', 'discipline', 'indigo', 'atom', 60),
  ('historia', 'História', 'discipline', 'amber', 'landmark', 70),
  ('geografia', 'Geografia', 'discipline', 'lime', 'globe', 80),
  ('filosofia', 'Filosofia', 'discipline', 'purple', 'brain', 90),
  ('sociologia', 'Sociologia', 'discipline', 'orange', 'users', 100),
  ('ingles', 'Inglês', 'discipline', 'sky', 'message-circle', 110),
  ('outros-idiomas', 'Espanhol e outros idiomas', 'discipline', 'sky', 'languages', 120),
  ('informatica', 'Informática', 'discipline', 'slate', 'laptop', 130),
  ('enem', 'Preparação para o ENEM', 'exam_prep', 'yellow', 'graduation-cap', 140),
  ('vestibulares', 'Vestibulares', 'exam_prep', 'yellow', 'target', 150),
  ('outras', 'Outras disciplinas', 'other', 'slate', 'shapes', 160)
on conflict (slug) do nothing;

-- Perfis -----------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9](?:[a-z0-9_.]{1,22})[a-z0-9]$' and username !~ '\.\.'),
  display_name text not null default '' check (char_length(display_name) <= 60),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https?://'),
  bio text check (bio is null or char_length(bio) <= 280),
  school_stage public.school_stage,
  grade_year smallint check (grade_year is null or grade_year between 1 and 9),
  birth_date date check (birth_date is null or birth_date >= date '1900-01-01'),
  account_status public.account_status not null default 'active',
  profile_visibility text not null default 'private' check (profile_visibility in ('public', 'private')),
  show_in_leaderboard boolean not null default true,
  show_stats_publicly boolean not null default false,
  show_achievements_publicly boolean not null default true,
  onboarding_completed_at timestamptz,
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create index profiles_username_trgm_idx on public.profiles using gin (username extensions.gin_trgm_ops);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Papéis administrativos (só o servidor escreve) ---------------------------------
create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.user_roles enable row level security;
create policy "user_roles: cada um vê os próprios papéis" on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role in ('admin', 'moderator')
  );
$$;

create policy "profiles: dono lê o próprio perfil" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.is_moderator());
create policy "profiles: dono atualiza o próprio perfil" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Colunas que o próprio usuário pode alterar. Status da conta, datas de
-- criação e o id ficam fora: só o servidor muda.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (
  username, display_name, avatar_url, bio, school_stage, grade_year, birth_date,
  profile_visibility, show_in_leaderboard, show_stats_publicly, show_achievements_publicly,
  onboarding_completed_at, terms_accepted_at, privacy_accepted_at
) on public.profiles to authenticated;

-- Consentimento de responsáveis -------------------------------------------------
create table public.guardian_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  guardian_name text not null check (char_length(guardian_name) between 3 and 120),
  guardian_email text not null check (guardian_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  token_hash text not null unique check (char_length(token_hash) = 64),
  status public.consent_status not null default 'pending',
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.guardian_consents enable row level security;
create index guardian_consents_user_idx on public.guardian_consents (user_id, created_at desc);
create policy "guardian_consents: titular vê os próprios pedidos" on public.guardian_consents
  for select to authenticated using (user_id = (select auth.uid()));
create trigger guardian_consents_updated_at before update on public.guardian_consents
  for each row execute function public.set_updated_at();

create or replace function public.age_in_years(p_birth date)
returns integer
language sql
stable
set search_path = ''
as $$
  select case when p_birth is null then null else extract(year from age(current_date, p_birth))::integer end;
$$;

create or replace function public.has_guardian_consent(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.guardian_consents
    where user_id = p_user_id and status = 'granted'
  );
$$;

-- Regras de privacidade aplicadas no banco, independentemente do cliente:
--   * menores sem consentimento não têm perfil público nem estatísticas públicas;
--   * crianças abaixo do limite ficam com a conta pendente até o consentimento;
--   * data de nascimento só é definida uma vez pelo próprio usuário;
--   * nomes de usuário reservados são bloqueados.
create or replace function public.enforce_profile_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_age integer;
  v_consent boolean;
  v_child_limit integer := public.setting_int('child_age_limit', 12);
  v_public_min integer := public.setting_int('community_min_age_without_guardian', 16);
begin
  if current_user = 'authenticated' then
    if tg_op = 'UPDATE' and old.birth_date is not null and new.birth_date is distinct from old.birth_date then
      raise exception 'A data de nascimento já foi informada. Fale com o suporte para corrigi-la.'
        using errcode = 'P0001';
    end if;
    if new.username in ('admin', 'administrador', 'grifo', 'suporte', 'moderacao', 'moderador',
                        'api', 'app', 'root', 'sistema', 'oficial', 'contato', 'ajuda') then
      raise exception 'Este nome de usuário é reservado.' using errcode = 'P0001';
    end if;
    if new.terms_accepted_at is distinct from (case when tg_op = 'UPDATE' then old.terms_accepted_at end)
       and new.terms_accepted_at is not null then
      new.terms_accepted_at := now();
    end if;
    if new.privacy_accepted_at is distinct from (case when tg_op = 'UPDATE' then old.privacy_accepted_at end)
       and new.privacy_accepted_at is not null then
      new.privacy_accepted_at := now();
    end if;
  end if;

  if new.birth_date is not null and new.birth_date > current_date then
    raise exception 'Data de nascimento no futuro.' using errcode = '22023';
  end if;

  v_age := public.age_in_years(new.birth_date);
  v_consent := public.has_guardian_consent(new.id);

  if (v_age is null or v_age < v_public_min) and not v_consent then
    new.profile_visibility := 'private';
    new.show_stats_publicly := false;
  end if;

  if new.account_status <> 'suspended' then
    if v_age is not null and v_age < v_child_limit and not v_consent then
      new.account_status := 'pending_guardian';
    elsif new.account_status = 'pending_guardian' and (v_consent or (v_age is not null and v_age >= v_child_limit)) then
      new.account_status := 'active';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_enforce_rules before insert or update on public.profiles
  for each row execute function public.enforce_profile_rules();

-- Cartão público de perfil: só expõe nome e foto quando o perfil é público.
create view public.profile_cards
with (security_invoker = false) as
select
  p.id,
  p.username,
  case when p.profile_visibility = 'public' then p.display_name end as display_name,
  case when p.profile_visibility = 'public' then p.avatar_url end as avatar_url,
  case when p.profile_visibility = 'public' then p.bio end as bio,
  (p.profile_visibility = 'public') as is_public,
  p.created_at
from public.profiles p
where p.account_status = 'active';
revoke all on public.profile_cards from anon, authenticated;
grant select on public.profile_cards to anon, authenticated;

-- Preferências de estudo ---------------------------------------------------------
create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  timezone text not null default 'America/Sao_Paulo' check (char_length(timezone) between 3 and 64),
  daily_goal_minutes smallint not null default 30 check (daily_goal_minutes between 5 and 600),
  study_weekdays smallint[] not null default '{1,2,3,4,5}'
    check (study_weekdays <@ '{0,1,2,3,4,5,6}'::smallint[] and cardinality(study_weekdays) between 1 and 7),
  preferred_period text check (preferred_period is null or preferred_period in ('morning', 'afternoon', 'evening', 'night')),
  goals text[] not null default '{}' check (cardinality(goals) <= 10),
  difficulties text[] not null default '{}' check (cardinality(difficulties) <= 10),
  explanation_level text not null default 'balanced' check (explanation_level in ('simple', 'balanced', 'deep')),
  email_reminders boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
create policy "user_preferences: dono lê" on public.user_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_preferences: dono altera" on public.user_preferences
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, delete on public.user_preferences from authenticated;
create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();

create or replace function public.validate_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Fuso horário inválido: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger user_preferences_validate_tz before insert or update of timezone on public.user_preferences
  for each row execute function public.validate_timezone();

create table public.user_subjects (
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, subject_id)
);
alter table public.user_subjects enable row level security;
create policy "user_subjects: dono gerencia" on public.user_subjects
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
