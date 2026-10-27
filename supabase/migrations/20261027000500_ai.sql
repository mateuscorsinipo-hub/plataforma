-- Inteligência artificial: conversas do tutor, mensagens e materiais gerados.

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  folder_id uuid,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null default 'Nova conversa' check (char_length(btrim(title)) between 1 and 120),
  summary text check (summary is null or char_length(summary) <= 8000),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (folder_id, user_id) references public.folders (id, user_id) on delete set null (folder_id)
);
alter table public.ai_conversations enable row level security;
create index ai_conversations_user_idx on public.ai_conversations (user_id, last_message_at desc);
create index ai_conversations_subject_idx on public.ai_conversations (user_id, subject_id);
create policy "ai_conversations: dono gerencia" on public.ai_conversations
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger ai_conversations_updated_at before update on public.ai_conversations
  for each row execute function public.set_updated_at();

-- Documentos usados como contexto de uma conversa.
create table public.ai_conversation_sources (
  conversation_id uuid not null,
  file_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (conversation_id, file_id),
  foreign key (conversation_id, user_id) references public.ai_conversations (id, user_id) on delete cascade,
  foreign key (file_id, user_id) references public.uploaded_files (id, user_id) on delete cascade
);
alter table public.ai_conversation_sources enable row level security;
create policy "ai_conversation_sources: dono gerencia" on public.ai_conversation_sources
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 100000),
  attachments jsonb not null default '[]' check (jsonb_typeof(attachments) = 'array'),
  citations jsonb not null default '[]' check (jsonb_typeof(citations) = 'array'),
  status text not null default 'complete' check (status in ('complete', 'error', 'cancelled')),
  model text check (model is null or char_length(model) <= 100),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  error_code text check (error_code is null or char_length(error_code) <= 60),
  created_at timestamptz not null default now(),
  foreign key (conversation_id, user_id) references public.ai_conversations (id, user_id) on delete cascade
);
alter table public.ai_messages enable row level security;
create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);
create policy "ai_messages: dono lê" on public.ai_messages
  for select to authenticated using (user_id = (select auth.uid()));
create policy "ai_messages: dono registra" on public.ai_messages
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "ai_messages: dono remove" on public.ai_messages
  for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.ai_messages from authenticated;

create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  folder_id uuid,
  subject_id uuid references public.subjects (id) on delete set null,
  kind public.generation_kind not null,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  params jsonb not null default '{}' check (jsonb_typeof(params) = 'object'),
  source_chars integer check (source_chars is null or source_chars >= 0),
  content jsonb,
  content_markdown text check (content_markdown is null or char_length(content_markdown) <= 200000),
  status public.generation_status not null default 'pending',
  error_message text check (error_message is null or char_length(error_message) <= 500),
  model text check (model is null or char_length(model) <= 100),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (folder_id, user_id) references public.folders (id, user_id) on delete set null (folder_id)
);
alter table public.ai_generations enable row level security;
create index ai_generations_user_idx on public.ai_generations (user_id, created_at desc);
create index ai_generations_folder_idx on public.ai_generations (folder_id) where folder_id is not null;
create policy "ai_generations: dono lê" on public.ai_generations
  for select to authenticated using (user_id = (select auth.uid()));
create policy "ai_generations: dono cria" on public.ai_generations
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "ai_generations: dono edita" on public.ai_generations
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "ai_generations: dono exclui" on public.ai_generations
  for delete to authenticated using (user_id = (select auth.uid()));
create trigger ai_generations_updated_at before update on public.ai_generations
  for each row execute function public.set_updated_at();

create table public.ai_generation_sources (
  generation_id uuid not null,
  file_id uuid not null,
  user_id uuid not null,
  primary key (generation_id, file_id),
  foreign key (generation_id, user_id) references public.ai_generations (id, user_id) on delete cascade,
  foreign key (file_id, user_id) references public.uploaded_files (id, user_id) on delete cascade
);
alter table public.ai_generation_sources enable row level security;
create policy "ai_generation_sources: dono gerencia" on public.ai_generation_sources
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
