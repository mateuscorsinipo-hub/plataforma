-- Pastas, arquivos enviados, trechos extraídos e buckets de armazenamento.

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  color text not null default 'blue' check (color ~ '^[a-z]{3,16}$'),
  subject_id uuid references public.subjects (id) on delete set null,
  exam_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
alter table public.folders enable row level security;
create unique index folders_user_name_idx on public.folders (user_id, lower(btrim(name)));
create policy "folders: dono gerencia" on public.folders
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger folders_updated_at before update on public.folders
  for each row execute function public.set_updated_at();

create table public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  folder_id uuid,
  bucket text not null default 'uploads' check (bucket in ('uploads')),
  storage_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 255),
  mime_type text not null check (char_length(mime_type) <= 120),
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  purpose text not null default 'study' check (purpose in ('study', 'material', 'chat')),
  status public.file_status not null default 'pending_upload',
  page_count integer check (page_count is null or page_count >= 0),
  char_count integer check (char_count is null or char_count >= 0),
  chunk_count integer check (chunk_count is null or chunk_count >= 0),
  error_message text check (error_message is null or char_length(error_message) <= 500),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (folder_id, user_id) references public.folders (id, user_id) on delete set null (folder_id),
  check (storage_path like user_id::text || '/%')
);
alter table public.uploaded_files enable row level security;
create index uploaded_files_user_idx on public.uploaded_files (user_id, created_at desc);
create index uploaded_files_folder_idx on public.uploaded_files (folder_id) where folder_id is not null;
create policy "uploaded_files: dono lê" on public.uploaded_files
  for select to authenticated using (user_id = (select auth.uid()));
create policy "uploaded_files: dono altera nome e pasta" on public.uploaded_files
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "uploaded_files: dono exclui" on public.uploaded_files
  for delete to authenticated using (user_id = (select auth.uid()));
-- Criação e mudança de status só pelo servidor (que valida tipo, tamanho e cota).
revoke insert, update on public.uploaded_files from authenticated;
grant update (original_name, folder_id) on public.uploaded_files to authenticated;
create trigger uploaded_files_updated_at before update on public.uploaded_files
  for each row execute function public.set_updated_at();

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null,
  user_id uuid not null,
  chunk_index integer not null check (chunk_index >= 0),
  page_start integer check (page_start is null or page_start >= 1),
  page_end integer check (page_end is null or page_end >= 1),
  content text not null check (char_length(content) between 1 and 20000),
  token_estimate integer not null check (token_estimate > 0),
  search_vector tsvector generated always as (to_tsvector('public.portuguese_unaccent'::regconfig, content)) stored,
  created_at timestamptz not null default now(),
  unique (file_id, chunk_index),
  foreign key (file_id, user_id) references public.uploaded_files (id, user_id) on delete cascade
);
alter table public.document_chunks enable row level security;
create index document_chunks_search_idx on public.document_chunks using gin (search_vector);
create index document_chunks_user_idx on public.document_chunks (user_id);
create policy "document_chunks: dono lê" on public.document_chunks
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.document_chunks from authenticated;

-- Busca dos trechos mais relevantes dentro dos arquivos escolhidos pelo usuário.
-- security invoker: o RLS de document_chunks garante que só os próprios arquivos entram.
create or replace function public.search_document_chunks(p_file_ids uuid[], p_query text, p_limit integer default 8)
returns table (
  id uuid,
  file_id uuid,
  chunk_index integer,
  page_start integer,
  page_end integer,
  content text,
  token_estimate integer,
  rank real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select websearch_to_tsquery('public.portuguese_unaccent'::regconfig, coalesce(p_query, '')) as query
  )
  select c.id, c.file_id, c.chunk_index, c.page_start, c.page_end, c.content, c.token_estimate,
         ts_rank_cd(c.search_vector, q.query) as rank
  from public.document_chunks c, q
  where c.file_id = any (p_file_ids)
    and c.search_vector @@ q.query
  order by rank desc, c.chunk_index
  limit least(greatest(p_limit, 1), 30);
$$;

-- Buckets ------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('uploads', 'uploads', false, 52428800, array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png', 'image/jpeg', 'image/webp',
    'text/plain', 'text/markdown'
  ]),
  ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- uploads: envio só por URL assinada emitida pelo servidor; leitura e exclusão
-- apenas dentro da pasta do próprio usuário.
create policy "uploads: dono lê os próprios objetos" on storage.objects
  for select to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "uploads: dono exclui os próprios objetos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- avatars: um único arquivo por usuário, no caminho {uid}/avatar.
create policy "avatars: dono lê o próprio objeto" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar');
create policy "avatars: dono envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar');
create policy "avatars: dono substitui" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar')
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar');
create policy "avatars: dono remove" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar');
