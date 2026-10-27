-- Indicadores de desempenho calculados a partir dos dados persistidos.
-- Funções security invoker: o RLS de cada tabela restringe aos dados do próprio usuário.

create or replace function public.stats_daily(p_from date, p_to date, p_tz text default 'America/Sao_Paulo')
returns table (
  day date,
  study_minutes integer,
  reviews integer,
  quizzes integer,
  xp integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with days as (
    select generate_series(p_from, least(p_to, p_from + 366), interval '1 day')::date as day
  ),
  sessions as (
    select local_date as day, sum(duration_seconds) / 60 as minutes
      from public.study_sessions
     where user_id = (select auth.uid()) and local_date between p_from and p_to
     group by local_date
  ),
  revs as (
    select (reviewed_at at time zone p_tz)::date as day, count(*) as n
      from public.flashcard_reviews
     where user_id = (select auth.uid())
       and reviewed_at >= (p_from::timestamp at time zone p_tz)
       and reviewed_at < ((p_to + 1)::timestamp at time zone p_tz)
     group by 1
  ),
  quiz as (
    select (submitted_at at time zone p_tz)::date as day, count(*) as n
      from public.quiz_attempts
     where user_id = (select auth.uid()) and submitted_at is not null
       and submitted_at >= (p_from::timestamp at time zone p_tz)
       and submitted_at < ((p_to + 1)::timestamp at time zone p_tz)
     group by 1
  ),
  xp as (
    select local_date as day, sum(amount) as n
      from public.xp_transactions
     where user_id = (select auth.uid()) and local_date between p_from and p_to
     group by local_date
  )
  select d.day,
         coalesce(s.minutes, 0)::integer,
         coalesce(r.n, 0)::integer,
         coalesce(q.n, 0)::integer,
         coalesce(x.n, 0)::integer
    from days d
    left join sessions s on s.day = d.day
    left join revs r on r.day = d.day
    left join quiz q on q.day = d.day
    left join xp x on x.day = d.day
   order by d.day;
$$;
grant execute on function public.stats_daily(date, date, text) to authenticated;

create or replace function public.stats_subjects(p_from date, p_to date, p_tz text default 'America/Sao_Paulo')
returns table (
  subject_id uuid,
  answered integer,
  correct integer,
  study_minutes integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with answers as (
    select coalesce(q.subject_id, z.subject_id) as subject_id,
           count(*) as answered,
           count(*) filter (where a.is_correct) as correct
      from public.quiz_answers a
      join public.quiz_questions q on q.id = a.question_id
      join public.quizzes z on z.id = q.quiz_id
      join public.quiz_attempts t on t.id = a.attempt_id and t.status = 'graded'
     where a.user_id = (select auth.uid())
       and a.answered_at >= (p_from::timestamp at time zone p_tz)
       and a.answered_at < ((p_to + 1)::timestamp at time zone p_tz)
       and a.is_correct is not null
     group by 1
  ),
  minutes as (
    select subject_id, sum(duration_seconds) / 60 as minutes
      from public.study_sessions
     where user_id = (select auth.uid()) and local_date between p_from and p_to
     group by subject_id
  )
  select coalesce(a.subject_id, m.subject_id),
         coalesce(a.answered, 0)::integer,
         coalesce(a.correct, 0)::integer,
         coalesce(m.minutes, 0)::integer
    from answers a
    full join minutes m on m.subject_id = a.subject_id
   where coalesce(a.subject_id, m.subject_id) is not null;
$$;
grant execute on function public.stats_subjects(date, date, text) to authenticated;

-- Temas com mais erros (quizzes, simulados e cartões esquecidos) para priorizar revisão.
create or replace function public.stats_weak_topics(p_limit integer default 8)
returns table (
  subject_id uuid,
  topic text,
  answered integer,
  correct integer,
  accuracy numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(q.subject_id, z.subject_id) as subject_id,
         coalesce(nullif(btrim(q.topic), ''), nullif(btrim(z.topic), ''), z.title) as topic,
         count(*)::integer as answered,
         (count(*) filter (where a.is_correct))::integer as correct,
         round((count(*) filter (where a.is_correct))::numeric / count(*), 3) as accuracy
    from public.quiz_answers a
    join public.quiz_questions q on q.id = a.question_id
    join public.quizzes z on z.id = q.quiz_id
   where a.user_id = (select auth.uid())
     and a.is_correct is not null
     and a.answered_at >= now() - interval '60 days'
   group by 1, 2
  having count(*) >= 3
     and (count(*) filter (where a.is_correct))::numeric / count(*) < 0.7
   order by accuracy asc, answered desc
   limit least(greatest(p_limit, 1), 30);
$$;
grant execute on function public.stats_weak_topics(integer) to authenticated;

-- Erros recorrentes de um quiz: questões erradas em mais de uma tentativa.
create or replace function public.quiz_recurring_errors(p_quiz_id uuid)
returns table (question_id uuid, prompt text, topic text, attempts integer, wrong integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select q.id, q.prompt, q.topic,
         count(*)::integer as attempts,
         (count(*) filter (where a.is_correct = false))::integer as wrong
    from public.quiz_questions q
    join public.quiz_answers a on a.question_id = q.id
    join public.quiz_attempts t on t.id = a.attempt_id and t.status = 'graded'
   where q.quiz_id = p_quiz_id and q.user_id = (select auth.uid())
   group by q.id, q.prompt, q.topic
  having count(*) filter (where a.is_correct = false) >= 2
   order by wrong desc, attempts desc
   limit 20;
$$;
grant execute on function public.quiz_recurring_errors(uuid) to authenticated;
