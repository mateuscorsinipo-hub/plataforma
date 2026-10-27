-- Aprendizagem: flashcards com repetição espaçada, quizzes e simulados.
-- Simulados são quizzes com kind = 'mock_exam' (tempo, marcação e correção de
-- dissertativas): uma só estrutura de questões, tentativas e respostas.

create table public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  folder_id uuid,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  source_generation_id uuid references public.ai_generations (id) on delete set null,
  source_material_id uuid references public.study_materials (id) on delete set null,
  cards_count integer not null default 0 check (cards_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (folder_id, user_id) references public.folders (id, user_id) on delete set null (folder_id)
);
alter table public.flashcard_decks enable row level security;
create index flashcard_decks_user_idx on public.flashcard_decks (user_id, updated_at desc);
create policy "flashcard_decks: dono gerencia" on public.flashcard_decks
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.flashcard_decks from authenticated;
grant update (folder_id, subject_id, title, description) on public.flashcard_decks to authenticated;
create trigger flashcard_decks_updated_at before update on public.flashcard_decks
  for each row execute function public.set_updated_at();

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null,
  user_id uuid not null,
  front text not null check (char_length(btrim(front)) between 1 and 2000),
  back text not null check (char_length(btrim(back)) between 1 and 4000),
  explanation text check (explanation is null or char_length(explanation) <= 4000),
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  source_ref text check (source_ref is null or char_length(source_ref) <= 200),
  state public.card_state not null default 'new',
  due_at timestamptz not null default now(),
  stability double precision not null default 0 check (stability >= 0),
  difficulty double precision not null default 0 check (difficulty >= 0),
  elapsed_days integer not null default 0 check (elapsed_days >= 0),
  scheduled_days integer not null default 0 check (scheduled_days >= 0),
  learning_steps integer not null default 0 check (learning_steps >= 0),
  reps integer not null default 0 check (reps >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  last_review_at timestamptz,
  suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (deck_id, user_id) references public.flashcard_decks (id, user_id) on delete cascade
);
alter table public.flashcards enable row level security;
create index flashcards_deck_idx on public.flashcards (deck_id, created_at);
create index flashcards_due_idx on public.flashcards (user_id, due_at) where not suspended;
create policy "flashcards: dono gerencia" on public.flashcards
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger flashcards_updated_at before update on public.flashcards
  for each row execute function public.set_updated_at();

create or replace function public.flashcards_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.flashcard_decks set cards_count = cards_count + 1 where id = new.deck_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.flashcard_decks set cards_count = greatest(cards_count - 1, 0) where id = old.deck_id;
    return old;
  elsif new.deck_id <> old.deck_id then
    update public.flashcard_decks set cards_count = greatest(cards_count - 1, 0) where id = old.deck_id;
    update public.flashcard_decks set cards_count = cards_count + 1 where id = new.deck_id;
  end if;
  return new;
end;
$$;
create trigger flashcards_count after insert or delete or update of deck_id on public.flashcards
  for each row execute function public.flashcards_count();

create table public.flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null,
  user_id uuid not null,
  rating smallint not null check (rating between 1 and 4),
  state_before public.card_state not null,
  due_before timestamptz,
  stability_after double precision,
  difficulty_after double precision,
  scheduled_days integer,
  elapsed_days integer,
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 3600000),
  reviewed_at timestamptz not null default now(),
  foreign key (card_id, user_id) references public.flashcards (id, user_id) on delete cascade
);
alter table public.flashcard_reviews enable row level security;
create index flashcard_reviews_user_idx on public.flashcard_reviews (user_id, reviewed_at desc);
create index flashcard_reviews_card_idx on public.flashcard_reviews (card_id, reviewed_at desc);
create policy "flashcard_reviews: dono lê" on public.flashcard_reviews
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.flashcard_reviews from authenticated;

-- Aplica uma revisão calculada pelo agendador no servidor, de forma atômica e
-- com controle de concorrência: se outra revisão chegou antes, nada é gravado.
create or replace function public.apply_flashcard_review(
  p_card_id uuid,
  p_rating smallint,
  p_expected_last_review timestamptz,
  p_state public.card_state,
  p_due_at timestamptz,
  p_stability double precision,
  p_difficulty double precision,
  p_elapsed_days integer,
  p_scheduled_days integer,
  p_learning_steps integer,
  p_reps integer,
  p_lapses integer,
  p_reviewed_at timestamptz,
  p_duration_ms integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card public.flashcards%rowtype;
  v_review_id uuid;
begin
  select * into v_card from public.flashcards
   where id = p_card_id and user_id = (select auth.uid())
   for update;
  if not found then
    raise exception 'Cartão não encontrado.' using errcode = 'P0002';
  end if;
  if v_card.last_review_at is distinct from p_expected_last_review then
    raise exception 'Este cartão já foi revisado em outra aba.' using errcode = '40001';
  end if;
  if p_reviewed_at > now() + interval '1 minute' or p_reviewed_at < now() - interval '1 day' then
    raise exception 'Horário de revisão inválido.' using errcode = '22023';
  end if;

  update public.flashcards
     set state = p_state,
         due_at = p_due_at,
         stability = p_stability,
         difficulty = p_difficulty,
         elapsed_days = p_elapsed_days,
         scheduled_days = p_scheduled_days,
         learning_steps = p_learning_steps,
         reps = p_reps,
         lapses = p_lapses,
         last_review_at = p_reviewed_at
   where id = p_card_id;

  insert into public.flashcard_reviews (
    card_id, user_id, rating, state_before, due_before, stability_after, difficulty_after,
    scheduled_days, elapsed_days, duration_ms, reviewed_at
  ) values (
    p_card_id, v_card.user_id, p_rating, v_card.state, v_card.due_at, p_stability, p_difficulty,
    p_scheduled_days, p_elapsed_days, p_duration_ms, p_reviewed_at
  ) returning id into v_review_id;

  return v_review_id;
end;
$$;
revoke execute on function public.apply_flashcard_review(uuid, smallint, timestamptz, public.card_state, timestamptz,
  double precision, double precision, integer, integer, integer, integer, integer, timestamptz, integer) from public, anon;
grant execute on function public.apply_flashcard_review(uuid, smallint, timestamptz, public.card_state, timestamptz,
  double precision, double precision, integer, integer, integer, integer, integer, timestamptz, integer) to authenticated;

-- Quizzes e simulados -----------------------------------------------------------------
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.quiz_kind not null default 'quiz',
  folder_id uuid,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text check (description is null or char_length(description) <= 1000),
  topic text check (topic is null or char_length(topic) <= 120),
  difficulty public.difficulty not null default 'medium',
  exam_type text check (exam_type is null or exam_type in ('enem', 'vestibular', 'school', 'custom')),
  duration_minutes integer check (duration_minutes is null or duration_minutes between 5 and 600),
  source_generation_id uuid references public.ai_generations (id) on delete set null,
  questions_count integer not null default 0 check (questions_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (folder_id, user_id) references public.folders (id, user_id) on delete set null (folder_id),
  check (kind = 'quiz' or duration_minutes is not null)
);
alter table public.quizzes enable row level security;
create index quizzes_user_idx on public.quizzes (user_id, kind, updated_at desc);
create policy "quizzes: dono gerencia" on public.quizzes
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.quizzes from authenticated;
grant update (folder_id, subject_id, title, description, topic, difficulty, exam_type, duration_minutes)
  on public.quizzes to authenticated;
create trigger quizzes_updated_at before update on public.quizzes
  for each row execute function public.set_updated_at();

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null,
  user_id uuid not null,
  position integer not null check (position >= 0),
  type public.question_type not null,
  prompt text not null check (char_length(btrim(prompt)) between 1 and 5000),
  options jsonb not null default '[]' check (jsonb_typeof(options) = 'array'),
  correct_option_id text check (correct_option_id is null or char_length(correct_option_id) <= 20),
  reference_answer text check (reference_answer is null or char_length(reference_answer) <= 5000),
  explanation text check (explanation is null or char_length(explanation) <= 5000),
  subject_id uuid references public.subjects (id) on delete set null,
  topic text check (topic is null or char_length(topic) <= 120),
  points numeric(5, 2) not null default 1 check (points > 0 and points <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (quiz_id, user_id) references public.quizzes (id, user_id) on delete cascade,
  check (
    (type = 'open' and correct_option_id is null)
    or (type <> 'open' and correct_option_id is not null and jsonb_array_length(options) between 2 and 6)
  )
);
alter table public.quiz_questions enable row level security;
create unique index quiz_questions_position_idx on public.quiz_questions (quiz_id, position);
create policy "quiz_questions: dono gerencia" on public.quiz_questions
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger quiz_questions_updated_at before update on public.quiz_questions
  for each row execute function public.set_updated_at();

create or replace function public.quiz_questions_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.quizzes set questions_count = questions_count + 1 where id = new.quiz_id;
    return new;
  else
    update public.quizzes set questions_count = greatest(questions_count - 1, 0) where id = old.quiz_id;
    return old;
  end if;
end;
$$;
create trigger quiz_questions_count after insert or delete on public.quiz_questions
  for each row execute function public.quiz_questions_count();

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null,
  user_id uuid not null,
  status public.attempt_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  deadline_at timestamptz,
  submitted_at timestamptz,
  graded_at timestamptz,
  current_position integer not null default 0 check (current_position >= 0),
  flagged_question_ids uuid[] not null default '{}' check (cardinality(flagged_question_ids) <= 300),
  score numeric(7, 2),
  max_score numeric(7, 2),
  correct_count integer,
  total_count integer,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (quiz_id, user_id) references public.quizzes (id, user_id) on delete cascade
);
alter table public.quiz_attempts enable row level security;
create index quiz_attempts_user_idx on public.quiz_attempts (user_id, started_at desc);
create index quiz_attempts_quiz_idx on public.quiz_attempts (quiz_id, started_at desc);
create policy "quiz_attempts: dono lê" on public.quiz_attempts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "quiz_attempts: dono inicia" on public.quiz_attempts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "quiz_attempts: dono salva progresso" on public.quiz_attempts
  for update to authenticated
  using (user_id = (select auth.uid()) and status = 'in_progress')
  with check (user_id = (select auth.uid()));
create policy "quiz_attempts: dono exclui" on public.quiz_attempts
  for delete to authenticated using (user_id = (select auth.uid()));
revoke insert, update on public.quiz_attempts from authenticated;
grant insert (quiz_id, user_id) on public.quiz_attempts to authenticated;
grant update (current_position, flagged_question_ids) on public.quiz_attempts to authenticated;
create trigger quiz_attempts_updated_at before update on public.quiz_attempts
  for each row execute function public.set_updated_at();

create or replace function public.quiz_attempts_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_duration integer;
begin
  select duration_minutes into v_duration from public.quizzes where id = new.quiz_id;
  new.started_at := now();
  new.status := 'in_progress';
  new.deadline_at := case when v_duration is null then null else now() + make_interval(mins => v_duration) end;
  return new;
end;
$$;
create trigger quiz_attempts_before_insert before insert on public.quiz_attempts
  for each row execute function public.quiz_attempts_before_insert();

create table public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  user_id uuid not null,
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  selected_option_id text check (selected_option_id is null or char_length(selected_option_id) <= 20),
  answer_text text check (answer_text is null or char_length(answer_text) <= 10000),
  is_correct boolean,
  score numeric(5, 2),
  feedback jsonb,
  answered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_id),
  foreign key (attempt_id, user_id) references public.quiz_attempts (id, user_id) on delete cascade
);
alter table public.quiz_answers enable row level security;
create index quiz_answers_user_idx on public.quiz_answers (user_id, answered_at desc);
create index quiz_answers_question_idx on public.quiz_answers (question_id);

-- Respostas só entram enquanto a tentativa está aberta e dentro do prazo
-- (com 60 s de tolerância para a latência da última resposta).
create or replace function public.can_answer_attempt(p_attempt_id uuid, p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.quiz_attempts a
    join public.quiz_questions q on q.quiz_id = a.quiz_id and q.id = p_question_id
    where a.id = p_attempt_id
      and a.user_id = (select auth.uid())
      and a.status = 'in_progress'
      and (a.deadline_at is null or now() <= a.deadline_at + interval '60 seconds')
  );
$$;

create policy "quiz_answers: dono lê" on public.quiz_answers
  for select to authenticated using (user_id = (select auth.uid()));
create policy "quiz_answers: dono responde dentro do prazo" on public.quiz_answers
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_answer_attempt(attempt_id, question_id));
create policy "quiz_answers: dono altera dentro do prazo" on public.quiz_answers
  for update to authenticated
  using (user_id = (select auth.uid()) and public.can_answer_attempt(attempt_id, question_id))
  with check (user_id = (select auth.uid()) and public.can_answer_attempt(attempt_id, question_id));
revoke insert, update, delete on public.quiz_answers from authenticated;
grant insert (attempt_id, user_id, question_id, selected_option_id, answer_text) on public.quiz_answers to authenticated;
grant update (selected_option_id, answer_text, answered_at) on public.quiz_answers to authenticated;
create trigger quiz_answers_updated_at before update on public.quiz_answers
  for each row execute function public.set_updated_at();

-- Correção objetiva feita no banco: o cliente não consegue informar a própria nota.
create or replace function public.submit_quiz_attempt(p_attempt_id uuid)
returns public.quiz_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.quiz_attempts%rowtype;
  v_has_open boolean;
begin
  select * into v_attempt from public.quiz_attempts
   where id = p_attempt_id and user_id = (select auth.uid())
   for update;
  if not found then
    raise exception 'Tentativa não encontrada.' using errcode = 'P0002';
  end if;
  if v_attempt.status <> 'in_progress' then
    return v_attempt;
  end if;

  update public.quiz_answers a
     set is_correct = (a.selected_option_id is not distinct from q.correct_option_id and a.selected_option_id is not null),
         score = case when a.selected_option_id = q.correct_option_id then q.points else 0 end
    from public.quiz_questions q
   where a.attempt_id = p_attempt_id and q.id = a.question_id and q.type <> 'open';

  select exists (
    select 1 from public.quiz_questions q
    join public.quiz_answers a on a.question_id = q.id and a.attempt_id = p_attempt_id
    where q.quiz_id = v_attempt.quiz_id and q.type = 'open' and nullif(btrim(a.answer_text), '') is not null
  ) into v_has_open;

  update public.quiz_attempts t
     set status = case when v_has_open then 'submitted'::public.attempt_status else 'graded'::public.attempt_status end,
         submitted_at = now(),
         graded_at = case when v_has_open then null else now() end,
         duration_seconds = greatest(0, extract(epoch from (least(now(), coalesce(t.deadline_at, now())) - t.started_at))::integer),
         total_count = s.total,
         correct_count = s.correct,
         max_score = s.max_points,
         score = s.points
    from (
      select count(*)::integer as total,
             count(*) filter (where a.is_correct)::integer as correct,
             coalesce(sum(q.points), 0) as max_points,
             coalesce(sum(a.score) filter (where q.type <> 'open'), 0) as points
      from public.quiz_questions q
      left join public.quiz_answers a on a.question_id = q.id and a.attempt_id = p_attempt_id
      where q.quiz_id = v_attempt.quiz_id
    ) s
   where t.id = p_attempt_id
  returning t.* into v_attempt;

  return v_attempt;
end;
$$;
revoke execute on function public.submit_quiz_attempt(uuid) from public, anon;
grant execute on function public.submit_quiz_attempt(uuid) to authenticated;

-- Depois da correção assistida das dissertativas (feita pelo servidor), recalcula o total.
create or replace function public.finalize_quiz_attempt(p_attempt_id uuid)
returns public.quiz_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.quiz_attempts%rowtype;
begin
  update public.quiz_attempts t
     set status = 'graded',
         graded_at = now(),
         correct_count = s.correct,
         score = s.points
    from (
      select count(*) filter (where a.is_correct)::integer as correct,
             coalesce(sum(a.score), 0) as points
      from public.quiz_answers a
      where a.attempt_id = p_attempt_id
    ) s
   where t.id = p_attempt_id and t.status = 'submitted'
  returning t.* into v_attempt;
  return v_attempt;
end;
$$;
revoke execute on function public.finalize_quiz_attempt(uuid) from public, anon, authenticated;
grant execute on function public.finalize_quiz_attempt(uuid) to service_role;
