-- Engajamento: XP, níveis, sequência, conquistas, ligas semanais e notificações.
-- Toda concessão de XP passa por award_xp, executável apenas pelo service_role.

create table public.user_stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  xp_total integer not null default 0 check (xp_total >= 0),
  level integer not null default 1 check (level >= 1),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_active_date date,
  league text not null default 'bronze' check (league in ('bronze', 'prata', 'ouro', 'platina', 'diamante')),
  updated_at timestamptz not null default now()
);
alter table public.user_stats enable row level security;
create policy "user_stats: dono lê" on public.user_stats
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.user_stats from authenticated;

-- Garante a linha de estatísticas para perfis criados antes desta migração.
insert into public.user_stats (user_id) select id from public.profiles on conflict do nothing;

create table public.xp_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount between 1 and 10000),
  source_type text not null check (source_type ~ '^[a-z_]{3,40}$'),
  source_id text not null check (char_length(source_id) between 1 and 120),
  reason text check (reason is null or char_length(reason) <= 200),
  local_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);
alter table public.xp_transactions enable row level security;
create index xp_transactions_user_idx on public.xp_transactions (user_id, created_at desc);
create index xp_transactions_daily_idx on public.xp_transactions (user_id, source_type, local_date);
create policy "xp_transactions: dono lê" on public.xp_transactions
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.xp_transactions from authenticated;

create table public.leaderboard_entries (
  week_start date not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  league text not null check (league in ('bronze', 'prata', 'ouro', 'platina', 'diamante')),
  xp integer not null default 0 check (xp >= 0),
  updated_at timestamptz not null default now(),
  primary key (week_start, user_id)
);
alter table public.leaderboard_entries enable row level security;
create index leaderboard_entries_league_idx on public.leaderboard_entries (week_start, league, xp desc);

-- XP necessário para o nível n: 50 · (n − 1)². Mesma fórmula em src/lib/domain/gamification.ts.
create or replace function public.level_for_xp(p_xp integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select greatest(1, floor(sqrt(greatest(p_xp, 0)::numeric / 50))::integer + 1);
$$;

create or replace function public.leaderboard_week_start()
returns date
language sql
stable
set search_path = ''
as $$
  select date_trunc('week', (now() at time zone public.setting_text('leaderboard_timezone', 'America/Sao_Paulo')))::date;
$$;

create or replace function public.award_xp(
  p_user_id uuid,
  p_amount integer,
  p_source_type text,
  p_source_id text,
  p_reason text,
  p_local_date date,
  p_daily_cap integer default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_award integer := p_amount;
  v_today integer;
  v_rows integer;
  v_last date;
  v_streak integer;
  v_league text;
  v_week date := public.leaderboard_week_start();
begin
  if p_amount is null or p_amount <= 0 then
    return 0;
  end if;
  -- Serializa concessões do mesmo usuário para que o teto diário não seja furado em paralelo.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':xp', 0));

  if p_daily_cap is not null then
    select coalesce(sum(amount), 0) into v_today
      from public.xp_transactions
     where user_id = p_user_id and source_type = p_source_type and local_date = p_local_date;
    v_award := least(p_amount, greatest(p_daily_cap - v_today, 0));
    if v_award <= 0 then
      return 0;
    end if;
  end if;

  insert into public.xp_transactions (user_id, amount, source_type, source_id, reason, local_date)
  values (p_user_id, v_award, p_source_type, p_source_id, p_reason, p_local_date)
  on conflict (user_id, source_type, source_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return 0;
  end if;

  insert into public.user_stats (user_id) values (p_user_id) on conflict do nothing;
  select last_active_date, current_streak, league into v_last, v_streak, v_league
    from public.user_stats where user_id = p_user_id for update;

  v_streak := case
    when v_last = p_local_date then v_streak
    when v_last = p_local_date - 1 then v_streak + 1
    when v_last is null or v_last < p_local_date - 1 then 1
    else v_streak
  end;

  update public.user_stats
     set xp_total = xp_total + v_award,
         level = public.level_for_xp(xp_total + v_award),
         current_streak = v_streak,
         longest_streak = greatest(longest_streak, v_streak),
         last_active_date = greatest(coalesce(last_active_date, p_local_date), p_local_date),
         updated_at = now()
   where user_id = p_user_id;

  insert into public.leaderboard_entries (week_start, user_id, league, xp)
  values (v_week, p_user_id, v_league, v_award)
  on conflict (week_start, user_id) do update
    set xp = public.leaderboard_entries.xp + excluded.xp,
        updated_at = now();

  return v_award;
end;
$$;
revoke execute on function public.award_xp(uuid, integer, text, text, text, date, integer) from public, anon, authenticated;
grant execute on function public.award_xp(uuid, integer, text, text, text, date, integer) to service_role;

-- Sequência quebrada: zera quando o último dia ativo ficou para trás.
create or replace function public.refresh_streak(p_user_id uuid, p_local_date date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_streak integer;
begin
  update public.user_stats
     set current_streak = case when last_active_date is null or last_active_date < p_local_date - 1 then 0 else current_streak end
   where user_id = p_user_id
  returning current_streak into v_streak;
  return coalesce(v_streak, 0);
end;
$$;
revoke execute on function public.refresh_streak(uuid, date) from public, anon, authenticated;
grant execute on function public.refresh_streak(uuid, date) to service_role;

-- Conquistas ---------------------------------------------------------------------------
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]{3,60}$'),
  title text not null check (char_length(title) between 2 and 80),
  description text not null check (char_length(description) between 2 and 240),
  icon text not null default 'award' check (icon ~ '^[a-z0-9-]{2,40}$'),
  category text not null default 'geral' check (category in ('geral', 'revisao', 'pratica', 'constancia', 'comunidade', 'planejamento')),
  metric text not null check (metric in (
    'xp_total', 'longest_streak', 'flashcard_reviews', 'quizzes_completed', 'perfect_quizzes',
    'mock_exams_completed', 'materials_published', 'plan_tasks_completed', 'study_minutes', 'decks_created'
  )),
  threshold integer not null check (threshold > 0),
  xp_reward integer not null default 0 check (xp_reward between 0 and 1000),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.achievements enable row level security;
create policy "achievements: leitura pública" on public.achievements
  for select to anon, authenticated using (is_active);
create trigger achievements_updated_at before update on public.achievements
  for each row execute function public.set_updated_at();

insert into public.achievements (code, title, description, icon, category, metric, threshold, xp_reward, sort_order) values
  ('primeiro_passo', 'Primeiro passo', 'Ganhe seus primeiros 10 XP estudando.', 'footprints', 'geral', 'xp_total', 10, 5, 10),
  ('sequencia_3', 'Três dias seguidos', 'Estude em 3 dias consecutivos.', 'flame', 'constancia', 'longest_streak', 3, 15, 20),
  ('sequencia_7', 'Uma semana inteira', 'Estude em 7 dias consecutivos.', 'flame', 'constancia', 'longest_streak', 7, 40, 30),
  ('sequencia_30', 'Hábito formado', 'Estude em 30 dias consecutivos.', 'flame', 'constancia', 'longest_streak', 30, 150, 40),
  ('revisor_50', 'Memória em treino', 'Revise 50 flashcards.', 'layers', 'revisao', 'flashcard_reviews', 50, 20, 50),
  ('revisor_500', 'Memória de elefante', 'Revise 500 flashcards.', 'layers', 'revisao', 'flashcard_reviews', 500, 100, 60),
  ('quiz_1', 'Primeiro quiz', 'Conclua um quiz.', 'circle-help', 'pratica', 'quizzes_completed', 1, 10, 70),
  ('quiz_25', 'Pratica que faz', 'Conclua 25 quizzes.', 'circle-help', 'pratica', 'quizzes_completed', 25, 80, 80),
  ('quiz_perfeito', 'Gabaritou', 'Acerte todas as questões de um quiz com pelo menos 5 perguntas.', 'star', 'pratica', 'perfect_quizzes', 1, 30, 90),
  ('simulado_1', 'Ensaio geral', 'Conclua um simulado.', 'timer', 'pratica', 'mock_exams_completed', 1, 40, 100),
  ('plano_20', 'Plano em dia', 'Conclua 20 tarefas do plano de estudos.', 'calendar-check', 'planejamento', 'plan_tasks_completed', 20, 50, 110),
  ('tempo_600', 'Dez horas de estudo', 'Acumule 10 horas de estudo registradas.', 'clock', 'constancia', 'study_minutes', 600, 100, 120),
  ('autor_1', 'Primeira contribuição', 'Tenha um material publicado na biblioteca.', 'book-open', 'comunidade', 'materials_published', 1, 30, 130),
  ('baralho_1', 'Baralho próprio', 'Crie seu primeiro baralho de flashcards.', 'layers', 'revisao', 'decks_created', 1, 10, 140)
on conflict (code) do nothing;

create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
alter table public.user_achievements enable row level security;
create policy "user_achievements: dono lê" on public.user_achievements
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.user_achievements from authenticated;

-- Notificações dentro do app (criadas pelo servidor) --------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type ~ '^[a-z_]{3,40}$'),
  title text not null check (char_length(title) between 1 and 120),
  body text check (body is null or char_length(body) <= 500),
  link text check (link is null or (link ~ '^/[^/]' and char_length(link) <= 300)),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create policy "notifications: dono lê" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications: dono marca como lida" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications: dono apaga" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.achievement_metric(p_user_id uuid, p_metric text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v integer := 0;
begin
  case p_metric
    when 'xp_total' then
      select xp_total into v from public.user_stats where user_id = p_user_id;
    when 'longest_streak' then
      select longest_streak into v from public.user_stats where user_id = p_user_id;
    when 'flashcard_reviews' then
      select count(*) into v from public.flashcard_reviews where user_id = p_user_id;
    when 'quizzes_completed' then
      select count(*) into v from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
       where a.user_id = p_user_id and a.status = 'graded' and q.kind = 'quiz';
    when 'perfect_quizzes' then
      select count(*) into v from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
       where a.user_id = p_user_id and a.status = 'graded' and q.kind = 'quiz'
         and a.total_count >= 5 and a.correct_count = a.total_count;
    when 'mock_exams_completed' then
      select count(*) into v from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
       where a.user_id = p_user_id and a.status in ('submitted', 'graded') and q.kind = 'mock_exam';
    when 'materials_published' then
      select count(*) into v from public.study_materials where author_id = p_user_id and status = 'published';
    when 'plan_tasks_completed' then
      select count(*) into v from public.study_plan_tasks where user_id = p_user_id and status = 'done';
    when 'study_minutes' then
      select coalesce(sum(duration_seconds), 0) / 60 into v from public.study_sessions where user_id = p_user_id;
    when 'decks_created' then
      select count(*) into v from public.flashcard_decks where user_id = p_user_id;
    else
      v := 0;
  end case;
  return coalesce(v, 0);
end;
$$;
revoke execute on function public.achievement_metric(uuid, text) from public, anon, authenticated;

-- Avalia conquistas, concede XP de recompensa e notifica. Retorna os códigos liberados.
create or replace function public.check_achievements(p_user_id uuid, p_local_date date)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_unlocked text[] := '{}';
  v_rows integer;
begin
  for r in
    select a.* from public.achievements a
    where a.is_active
      and not exists (select 1 from public.user_achievements ua where ua.user_id = p_user_id and ua.achievement_id = a.id)
    order by a.sort_order
  loop
    if public.achievement_metric(p_user_id, r.metric) >= r.threshold then
      insert into public.user_achievements (user_id, achievement_id) values (p_user_id, r.id) on conflict do nothing;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then
        v_unlocked := array_append(v_unlocked, r.code);
        if r.xp_reward > 0 then
          perform public.award_xp(p_user_id, r.xp_reward, 'achievement', r.code, 'Conquista: ' || r.title, p_local_date, null);
        end if;
        insert into public.notifications (user_id, type, title, body, link)
        values (p_user_id, 'achievement_unlocked', 'Conquista desbloqueada: ' || r.title, r.description, '/app/conquistas');
      end if;
    end if;
  end loop;
  return v_unlocked;
end;
$$;
revoke execute on function public.check_achievements(uuid, date) from public, anon, authenticated;
grant execute on function public.check_achievements(uuid, date) to service_role;

-- Ranking da liga na semana atual: só aparece quem permite; nome público é o @usuário.
create or replace function public.get_league_leaderboard(p_limit integer default 30)
returns table (
  rank bigint,
  user_id uuid,
  username text,
  avatar_url text,
  level integer,
  xp integer,
  is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select coalesce((select league from public.user_stats where user_id = (select auth.uid())), 'bronze') as league
  ),
  board as (
    select e.user_id, e.xp, s.level, p.username,
           case when p.profile_visibility = 'public' then p.avatar_url end as avatar_url,
           rank() over (order by e.xp desc, e.updated_at asc) as rank
      from public.leaderboard_entries e
      join me on e.league = me.league
      join public.profiles p on p.id = e.user_id and p.account_status = 'active'
      join public.user_stats s on s.user_id = e.user_id
     where e.week_start = public.leaderboard_week_start()
       and (p.show_in_leaderboard or e.user_id = (select auth.uid()))
  )
  select b.rank, b.user_id, b.username, b.avatar_url, b.level, b.xp, b.user_id = (select auth.uid())
    from board b
   where b.rank <= least(greatest(p_limit, 1), 100) or b.user_id = (select auth.uid())
   order by b.rank;
$$;
revoke execute on function public.get_league_leaderboard(integer) from public, anon;
grant execute on function public.get_league_leaderboard(integer) to authenticated;

-- Virada semanal das ligas: 20% de cima sobem, 20% de baixo descem.
create or replace function public.rollover_leagues(p_week_start date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed integer;
begin
  with ranked as (
    select e.user_id, e.league, e.xp,
           row_number() over (partition by e.league order by e.xp desc, e.updated_at asc) as pos,
           count(*) over (partition by e.league) as total
      from public.leaderboard_entries e
     where e.week_start = p_week_start
  ),
  moves as (
    select user_id,
           case
             when xp > 0 and pos <= greatest(1, ceil(total * 0.2)) then
               case league when 'bronze' then 'prata' when 'prata' then 'ouro' when 'ouro' then 'platina' else 'diamante' end
             when total >= 5 and pos > total - floor(total * 0.2) then
               case league when 'diamante' then 'platina' when 'platina' then 'ouro' when 'ouro' then 'prata' else 'bronze' end
             else league
           end as new_league
      from ranked
  )
  update public.user_stats s
     set league = m.new_league, updated_at = now()
    from moves m
   where s.user_id = m.user_id and s.league <> m.new_league;
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;
revoke execute on function public.rollover_leagues(date) from public, anon, authenticated;
grant execute on function public.rollover_leagues(date) to service_role;

-- Perfil público: respeita as escolhas de privacidade de cada pessoa.
create or replace function public.get_public_profile(p_username text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'username', p.username,
    'is_public', p.profile_visibility = 'public',
    'display_name', case when p.profile_visibility = 'public' then p.display_name end,
    'avatar_url', case when p.profile_visibility = 'public' then p.avatar_url end,
    'bio', case when p.profile_visibility = 'public' then p.bio end,
    'member_since', p.created_at,
    'subjects', case when p.profile_visibility = 'public' then coalesce((
        select jsonb_agg(jsonb_build_object('slug', s.slug, 'name', s.name, 'color', s.color) order by s.sort_order)
          from public.user_subjects us join public.subjects s on s.id = us.subject_id
         where us.user_id = p.id), '[]'::jsonb) else '[]'::jsonb end,
    'stats', case when p.profile_visibility = 'public' and p.show_stats_publicly then (
        select jsonb_build_object('level', st.level, 'xp_total', st.xp_total, 'longest_streak', st.longest_streak)
          from public.user_stats st where st.user_id = p.id) end,
    'achievements', case when p.show_achievements_publicly then coalesce((
        select jsonb_agg(jsonb_build_object('code', a.code, 'title', a.title, 'icon', a.icon, 'unlocked_at', ua.unlocked_at)
                         order by ua.unlocked_at desc)
          from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id
         where ua.user_id = p.id), '[]'::jsonb) else '[]'::jsonb end,
    'materials_count', (select count(*) from public.study_materials m
                         where m.author_id = p.id and m.status = 'published' and m.visibility = 'public')
  )
  from public.profiles p
  where p.username = lower(p_username) and p.account_status = 'active';
$$;
grant execute on function public.get_public_profile(text) to anon, authenticated;

create or replace function public.search_profiles(p_query text, p_limit integer default 20)
returns table (username text, display_name text, avatar_url text, materials_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.username,
         case when p.profile_visibility = 'public' then p.display_name end,
         case when p.profile_visibility = 'public' then p.avatar_url end,
         (select count(*) from public.study_materials m
           where m.author_id = p.id and m.status = 'published' and m.visibility = 'public')
    from public.profiles p
   where p.account_status = 'active'
     and char_length(btrim(coalesce(p_query, ''))) >= 2
     and (
       p.username ilike '%' || btrim(p_query) || '%'
       or (p.profile_visibility = 'public'
           and public.immutable_unaccent(lower(p.display_name)) like '%' || public.immutable_unaccent(lower(btrim(p_query))) || '%')
     )
   order by (p.profile_visibility = 'public') desc, p.username
   limit least(greatest(p_limit, 1), 50);
$$;
grant execute on function public.search_profiles(text, integer) to anon, authenticated;
