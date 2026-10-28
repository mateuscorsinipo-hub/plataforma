-- Engajamento (fase 6): progresso das conquistas e métricas dos desafios semanais.
-- As métricas usam só tabelas que o usuário não grava diretamente (revisões, tentativas
-- corrigidas pelo banco, sessões de estudo registradas pelo servidor).

-- Conquistas com o progresso de quem pergunta. Cada métrica é calculada uma vez.
create or replace function public.my_achievements()
returns table (
  code text,
  title text,
  description text,
  icon text,
  category text,
  threshold integer,
  xp_reward integer,
  sort_order integer,
  progress integer,
  unlocked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select (select auth.uid()) as id
  ),
  metrics as (
    select m.metric, public.achievement_metric(me.id, m.metric) as value
      from (select distinct metric from public.achievements where is_active) m, me
     where me.id is not null
  )
  select a.code, a.title, a.description, a.icon, a.category, a.threshold, a.xp_reward, a.sort_order,
         least(coalesce(mt.value, 0), a.threshold),
         ua.unlocked_at
    from public.achievements a
    join metrics mt on mt.metric = a.metric
    cross join me
    left join public.user_achievements ua on ua.achievement_id = a.id and ua.user_id = me.id
   where a.is_active
   order by a.sort_order;
$$;
revoke execute on function public.my_achievements() from public, anon;
grant execute on function public.my_achievements() to authenticated;

-- Atividade verificável num intervalo de dias locais (fuso validado pelo servidor).
create or replace function public.weekly_activity(p_from date, p_to date, p_tz text default 'America/Sao_Paulo')
returns table (
  flashcard_reviews integer,
  quizzes_completed integer,
  mock_exams integer,
  correct_answers integer,
  study_minutes integer,
  active_days integer,
  focus_sessions integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select (p_from::timestamp at time zone p_tz) as starts, ((least(p_to, p_from + 31) + 1)::timestamp at time zone p_tz) as ends
  ),
  attempts as (
    select a.id, a.status, q.kind, q.questions_count
      from public.quiz_attempts a
      join public.quizzes q on q.id = a.quiz_id, bounds b
     where a.user_id = (select auth.uid())
       and a.submitted_at >= b.starts and a.submitted_at < b.ends
       and a.status in ('submitted', 'graded')
  ),
  sessions as (
    select local_date, activity_type, duration_seconds
      from public.study_sessions
     where user_id = (select auth.uid()) and local_date between p_from and least(p_to, p_from + 31)
  )
  select
    (select count(*)::integer from public.flashcard_reviews r, bounds b
      where r.user_id = (select auth.uid()) and r.reviewed_at >= b.starts and r.reviewed_at < b.ends),
    -- Quiz conta a partir de 5 questões: um quiz de uma pergunta não vale desafio.
    (select count(*)::integer from attempts where kind = 'quiz' and status = 'graded' and questions_count >= 5),
    (select count(*)::integer from attempts where kind = 'mock_exam'),
    (select count(*)::integer from public.quiz_answers qa join attempts t on t.id = qa.attempt_id
      where qa.user_id = (select auth.uid()) and qa.is_correct),
    (select (coalesce(sum(duration_seconds), 0) / 60)::integer from sessions),
    (select count(distinct local_date)::integer from sessions),
    (select count(*)::integer from sessions where activity_type = 'focus' and duration_seconds >= 1200);
$$;
revoke execute on function public.weekly_activity(date, date, text) from public, anon;
grant execute on function public.weekly_activity(date, date, text) to authenticated;

-- Posição do próprio usuário na liga da semana (mesmo quem não aparece no ranking se vê).
create or replace function public.my_league_status()
returns table (
  league text,
  week_start date,
  xp integer,
  rank bigint,
  members bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select s.user_id, s.league from public.user_stats s where s.user_id = (select auth.uid())
  ),
  board as (
    select e.user_id, e.xp, rank() over (order by e.xp desc, e.updated_at asc) as rank
      from public.leaderboard_entries e
      join me on e.league = me.league
     where e.week_start = public.leaderboard_week_start()
  )
  select me.league,
         public.leaderboard_week_start(),
         coalesce((select b.xp from board b where b.user_id = me.user_id), 0),
         (select b.rank from board b where b.user_id = me.user_id),
         (select count(*) from board)
    from me;
$$;
revoke execute on function public.my_league_status() from public, anon;
grant execute on function public.my_league_status() to authenticated;
