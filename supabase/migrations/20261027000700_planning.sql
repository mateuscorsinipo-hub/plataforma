-- Planejamento: planos de estudo, tarefas diárias, sessões registradas e calendário.

create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  goal text check (goal is null or char_length(goal) <= 300),
  exam_type text not null default 'school' check (exam_type in ('enem', 'vestibular', 'school', 'concurso', 'other')),
  exam_date date not null,
  start_date date not null,
  daily_minutes smallint not null check (daily_minutes between 10 and 720),
  weekdays smallint[] not null
    check (weekdays <@ '{0,1,2,3,4,5,6}'::smallint[] and cardinality(weekdays) between 1 and 7),
  level text not null default 'intermediate' check (level in ('beginner', 'intermediate', 'advanced')),
  target text check (target is null or char_length(target) <= 120),
  status public.plan_status not null default 'active',
  topics jsonb not null default '[]' check (jsonb_typeof(topics) = 'array' and jsonb_array_length(topics) <= 80),
  generator_version integer not null default 1,
  last_adapted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (exam_date >= start_date)
);
alter table public.study_plans enable row level security;
create index study_plans_user_idx on public.study_plans (user_id, status, exam_date);
create policy "study_plans: dono gerencia" on public.study_plans
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger study_plans_updated_at before update on public.study_plans
  for each row execute function public.set_updated_at();

create table public.study_plan_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  user_id uuid not null,
  scheduled_date date not null,
  task_type public.task_type not null,
  subject_id uuid references public.subjects (id) on delete set null,
  topic text check (topic is null or char_length(topic) <= 160),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 1000),
  estimated_minutes smallint not null check (estimated_minutes between 5 and 300),
  priority smallint not null default 2 check (priority between 1 and 3),
  status public.task_status not null default 'pending',
  completed_at timestamptz,
  original_date date,
  position integer not null default 0,
  link_type text check (link_type is null or link_type in ('deck', 'quiz', 'mock_exam', 'generation', 'material')),
  link_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (plan_id, user_id) references public.study_plans (id, user_id) on delete cascade
);
alter table public.study_plan_tasks enable row level security;
create index study_plan_tasks_user_date_idx on public.study_plan_tasks (user_id, scheduled_date, status);
create index study_plan_tasks_plan_idx on public.study_plan_tasks (plan_id, scheduled_date, position);
create policy "study_plan_tasks: dono gerencia" on public.study_plan_tasks
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger study_plan_tasks_updated_at before update on public.study_plan_tasks
  for each row execute function public.set_updated_at();

create or replace function public.study_plan_tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  if tg_op = 'UPDATE' and new.scheduled_date <> old.scheduled_date and new.original_date is null then
    new.original_date := old.scheduled_date;
  end if;
  return new;
end;
$$;
create trigger study_plan_tasks_before_write before insert or update on public.study_plan_tasks
  for each row execute function public.study_plan_tasks_before_write();

-- Sessões de estudo: gravadas pelo servidor ao concluir atividades verificáveis.
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  activity_type text not null
    check (activity_type in ('flashcards', 'quiz', 'mock_exam', 'tutor', 'studio', 'reading', 'plan_task', 'focus')),
  subject_id uuid references public.subjects (id) on delete set null,
  source_id uuid,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds between 1 and 14400),
  local_date date not null,
  created_at timestamptz not null default now(),
  check (ended_at >= started_at)
);
alter table public.study_sessions enable row level security;
create index study_sessions_user_date_idx on public.study_sessions (user_id, local_date);
create unique index study_sessions_source_idx on public.study_sessions (user_id, activity_type, source_id)
  where source_id is not null;
create policy "study_sessions: dono lê" on public.study_sessions
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.study_sessions from authenticated;

-- Cronômetro de foco: o início fica registrado no servidor para que a duração
-- não possa ser inventada pelo cliente.
create table public.focus_timers (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  task_id uuid references public.study_plan_tasks (id) on delete set null,
  started_at timestamptz not null default now()
);
alter table public.focus_timers enable row level security;
create policy "focus_timers: dono lê" on public.focus_timers
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.focus_timers from authenticated;

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (description is null or char_length(description) <= 1000),
  event_type text not null default 'other' check (event_type in ('exam', 'class', 'study', 'task', 'reminder', 'other')),
  subject_id uuid references public.subjects (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  timezone text not null default 'America/Sao_Paulo' check (char_length(timezone) between 3 and 64),
  recurrence text not null default 'none' check (recurrence in ('none', 'daily', 'weekly', 'biweekly', 'monthly')),
  recurrence_weekdays smallint[] check (recurrence_weekdays is null or recurrence_weekdays <@ '{0,1,2,3,4,5,6}'::smallint[]),
  recurrence_until date,
  location text check (location is null or char_length(location) <= 200),
  reminder_minutes integer check (reminder_minutes is null or reminder_minutes between 0 and 10080),
  plan_id uuid references public.study_plans (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at),
  check (ends_at - starts_at <= interval '14 days')
);
alter table public.calendar_events enable row level security;
create index calendar_events_user_idx on public.calendar_events (user_id, starts_at);
create index calendar_events_reminder_idx on public.calendar_events (starts_at) where reminder_minutes is not null;
create policy "calendar_events: dono gerencia" on public.calendar_events
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger calendar_events_updated_at before update on public.calendar_events
  for each row execute function public.set_updated_at();
create trigger calendar_events_validate_tz before insert or update of timezone on public.calendar_events
  for each row execute function public.validate_timezone();

-- Envios de lembrete já feitos, para não repetir ocorrências de eventos recorrentes.
create table public.reminder_deliveries (
  event_id uuid not null references public.calendar_events (id) on delete cascade,
  occurrence_at timestamptz not null,
  channel text not null check (channel in ('email', 'in_app')),
  sent_at timestamptz not null default now(),
  primary key (event_id, occurrence_at, channel)
);
alter table public.reminder_deliveries enable row level security;
