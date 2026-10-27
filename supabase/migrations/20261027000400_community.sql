-- Comunidade: materiais publicados, favoritos, avaliações, visualizações e denúncias.

create table public.study_materials (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  title text not null check (char_length(btrim(title)) between 5 and 140),
  description text not null default '' check (char_length(description) <= 1000),
  subject_id uuid not null references public.subjects (id) on delete restrict,
  school_stage public.school_stage,
  grade_year smallint check (grade_year is null or grade_year between 1 and 9),
  topic text check (topic is null or char_length(topic) <= 120),
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  material_type public.material_type not null default 'summary',
  content text not null default '' check (char_length(content) <= 100000),
  file_id uuid references public.uploaded_files (id) on delete set null,
  visibility public.visibility not null default 'public',
  status public.material_status not null default 'draft',
  moderation_note text check (moderation_note is null or char_length(moderation_note) <= 1000),
  copyright_declared_at timestamptz,
  published_at timestamptz,
  views_count integer not null default 0 check (views_count >= 0),
  favorites_count integer not null default 0 check (favorites_count >= 0),
  saves_count integer not null default 0 check (saves_count >= 0),
  rating_sum integer not null default 0 check (rating_sum >= 0),
  rating_count integer not null default 0 check (rating_count >= 0),
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.study_materials enable row level security;
create index study_materials_search_idx on public.study_materials using gin (search_vector);
create index study_materials_title_trgm_idx on public.study_materials using gin (title extensions.gin_trgm_ops);
create index study_materials_listing_idx on public.study_materials (status, visibility, published_at desc);
create index study_materials_subject_idx on public.study_materials (subject_id, status, published_at desc);
create index study_materials_author_idx on public.study_materials (author_id, created_at desc);
create index study_materials_views_idx on public.study_materials (views_count desc) where status = 'published';
create index study_materials_saves_idx on public.study_materials (saves_count desc) where status = 'published';
create index study_materials_tags_idx on public.study_materials using gin (tags);

create policy "study_materials: publicados visíveis, autor vê os seus" on public.study_materials
  for select to anon, authenticated
  using (
    (status = 'published' and visibility in ('public', 'unlisted'))
    or author_id = (select auth.uid())
    or public.is_moderator()
  );
create policy "study_materials: autor cria rascunho" on public.study_materials
  for insert to authenticated
  with check (author_id = (select auth.uid()) and status = 'draft');
create policy "study_materials: autor edita" on public.study_materials
  for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "study_materials: autor exclui" on public.study_materials
  for delete to authenticated using (author_id = (select auth.uid()));

-- Status, contadores e campos de moderação ficam fora do alcance do cliente.
revoke insert, update on public.study_materials from authenticated;
grant insert (
  author_id, slug, title, description, subject_id, school_stage, grade_year, topic, tags,
  material_type, content, file_id, visibility, copyright_declared_at
) on public.study_materials to authenticated;
grant update (
  title, description, subject_id, school_stage, grade_year, topic, tags,
  material_type, content, file_id, visibility, copyright_declared_at
) on public.study_materials to authenticated;

create or replace function public.study_materials_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tags text[];
begin
  select coalesce(array_agg(distinct t order by t), '{}')
    into v_tags
    from (
      select left(lower(btrim(x)), 30) as t from unnest(new.tags) as x
    ) s
   where t <> '';
  new.tags := v_tags[1:10];

  if new.file_id is not null and not exists (
    select 1 from public.uploaded_files f where f.id = new.file_id and f.user_id = new.author_id
  ) then
    raise exception 'Arquivo inválido para este material.' using errcode = '42501';
  end if;

  new.search_vector :=
    setweight(to_tsvector('public.portuguese_unaccent'::regconfig, coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('public.portuguese_unaccent'::regconfig,
      coalesce(new.topic, '') || ' ' || array_to_string(new.tags, ' ')), 'B') ||
    setweight(to_tsvector('public.portuguese_unaccent'::regconfig, coalesce(new.description, '')), 'C') ||
    setweight(to_tsvector('public.portuguese_unaccent'::regconfig, left(coalesce(new.content, ''), 20000)), 'D');

  -- Edição de um material publicado volta para revisão quando a moderação é prévia.
  if tg_op = 'UPDATE' and current_user = 'authenticated' and old.status = 'published'
     and public.setting_text('moderation_mode', 'pre') = 'pre'
     and (new.title, new.description, new.content, new.file_id, new.topic, new.tags)
         is distinct from (old.title, old.description, old.content, old.file_id, old.topic, old.tags) then
    new.status := 'pending_review';
  end if;

  return new;
end;
$$;
create trigger study_materials_before_write before insert or update on public.study_materials
  for each row execute function public.study_materials_before_write();
create trigger study_materials_updated_at before update on public.study_materials
  for each row execute function public.set_updated_at();

-- Envio para publicação: validações mínimas no banco, regras de idade e modo de moderação.
create or replace function public.submit_material(p_material_id uuid)
returns public.material_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_material public.study_materials%rowtype;
  v_age integer;
  v_min_age integer := public.setting_int('community_min_age_without_guardian', 16);
  v_status public.material_status;
begin
  select * into v_material from public.study_materials
   where id = p_material_id and author_id = (select auth.uid())
   for update;
  if not found then
    raise exception 'Material não encontrado.' using errcode = 'P0002';
  end if;
  if v_material.status = 'removed' then
    raise exception 'Este material foi removido pela moderação e não pode ser reenviado.' using errcode = 'P0001';
  end if;
  if v_material.status in ('pending_review', 'published') then
    return v_material.status;
  end if;
  if v_material.visibility = 'private' then
    raise exception 'Escolha a visibilidade pública ou por link para publicar.' using errcode = 'P0001';
  end if;
  if v_material.copyright_declared_at is null then
    raise exception 'Confirme que o material é seu ou que você tem autorização para publicá-lo.' using errcode = 'P0001';
  end if;
  if char_length(btrim(v_material.content)) < 200 and v_material.file_id is null then
    raise exception 'Escreva pelo menos 200 caracteres de conteúdo ou anexe um arquivo.' using errcode = 'P0001';
  end if;

  select public.age_in_years(birth_date) into v_age from public.profiles where id = v_material.author_id;
  if (v_age is null or v_age < v_min_age) and not public.has_guardian_consent(v_material.author_id) then
    raise exception 'Publicar na comunidade exige ter % anos ou o consentimento de um responsável.', v_min_age
      using errcode = 'P0001';
  end if;

  v_status := case when public.setting_text('moderation_mode', 'pre') = 'post' then 'published' else 'pending_review' end;
  update public.study_materials
     set status = v_status,
         moderation_note = null,
         published_at = case when v_status = 'published' then coalesce(published_at, now()) else published_at end
   where id = p_material_id;
  return v_status;
end;
$$;
revoke execute on function public.submit_material(uuid) from public, anon;
grant execute on function public.submit_material(uuid) to authenticated;

create or replace function public.withdraw_material(p_material_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.study_materials
     set status = 'draft'
   where id = p_material_id
     and author_id = (select auth.uid())
     and status in ('pending_review', 'published', 'rejected');
  if not found then
    raise exception 'Não foi possível despublicar este material.' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.withdraw_material(uuid) from public, anon;
grant execute on function public.withdraw_material(uuid) to authenticated;

-- Favoritos e itens salvos -----------------------------------------------------------
create table public.material_saves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  material_id uuid not null references public.study_materials (id) on delete cascade,
  kind text not null check (kind in ('favorite', 'saved')),
  folder_id uuid,
  created_at timestamptz not null default now(),
  primary key (user_id, material_id, kind),
  foreign key (folder_id, user_id) references public.folders (id, user_id) on delete set null (folder_id)
);
alter table public.material_saves enable row level security;
create index material_saves_user_idx on public.material_saves (user_id, kind, created_at desc);
create index material_saves_material_idx on public.material_saves (material_id);
create policy "material_saves: dono lê" on public.material_saves
  for select to authenticated using (user_id = (select auth.uid()));
create policy "material_saves: dono salva materiais publicados" on public.material_saves
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.study_materials m
      where m.id = material_id and m.status = 'published' and m.visibility in ('public', 'unlisted')
    )
  );
create policy "material_saves: dono move para pasta" on public.material_saves
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "material_saves: dono remove" on public.material_saves
  for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.material_saves from authenticated;
grant update (folder_id) on public.material_saves to authenticated;

create or replace function public.material_saves_counter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.study_materials
       set favorites_count = favorites_count + (case when new.kind = 'favorite' then 1 else 0 end),
           saves_count = saves_count + (case when new.kind = 'saved' then 1 else 0 end)
     where id = new.material_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.study_materials
       set favorites_count = greatest(favorites_count - (case when old.kind = 'favorite' then 1 else 0 end), 0),
           saves_count = greatest(saves_count - (case when old.kind = 'saved' then 1 else 0 end), 0)
     where id = old.material_id;
    return old;
  end if;
  return null;
end;
$$;
create trigger material_saves_counter after insert or delete on public.material_saves
  for each row execute function public.material_saves_counter();

-- Avaliação de utilidade (1 a 5) ------------------------------------------------------
create table public.material_ratings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  material_id uuid not null references public.study_materials (id) on delete cascade,
  value smallint not null check (value between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, material_id)
);
alter table public.material_ratings enable row level security;
create index material_ratings_material_idx on public.material_ratings (material_id);
create policy "material_ratings: dono lê" on public.material_ratings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "material_ratings: avalia material publicado de outra pessoa" on public.material_ratings
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.study_materials m
      where m.id = material_id and m.status = 'published' and m.author_id <> (select auth.uid())
    )
  );
create policy "material_ratings: dono altera" on public.material_ratings
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "material_ratings: dono remove" on public.material_ratings
  for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.material_ratings from authenticated;
grant update (value) on public.material_ratings to authenticated;
create trigger material_ratings_updated_at before update on public.material_ratings
  for each row execute function public.set_updated_at();

create or replace function public.material_ratings_counter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.study_materials
       set rating_sum = rating_sum + new.value, rating_count = rating_count + 1
     where id = new.material_id;
    return new;
  elsif tg_op = 'UPDATE' then
    update public.study_materials
       set rating_sum = greatest(rating_sum - old.value + new.value, 0)
     where id = new.material_id;
    return new;
  else
    update public.study_materials
       set rating_sum = greatest(rating_sum - old.value, 0), rating_count = greatest(rating_count - 1, 0)
     where id = old.material_id;
    return old;
  end if;
end;
$$;
create trigger material_ratings_counter after insert or update of value or delete on public.material_ratings
  for each row execute function public.material_ratings_counter();

-- Visualizações deduplicadas por pessoa e por dia --------------------------------------
create table public.material_views (
  material_id uuid not null references public.study_materials (id) on delete cascade,
  viewer_key text not null check (char_length(viewer_key) between 8 and 80),
  viewed_on date not null default current_date,
  viewer_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (material_id, viewer_key, viewed_on)
);
alter table public.material_views enable row level security;
create index material_views_viewer_idx on public.material_views (viewer_id, created_at desc) where viewer_id is not null;

-- Chamado só pelo servidor (service_role), que calcula a chave anônima a partir
-- de IP e agente com sal diário. O autor não conta visualização do próprio material.
create or replace function public.record_material_view(p_material_id uuid, p_viewer_key text, p_viewer_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
  v_inserted integer;
begin
  select author_id into v_author from public.study_materials
   where id = p_material_id and status = 'published' and visibility in ('public', 'unlisted');
  if not found or v_author = p_viewer_id then
    return false;
  end if;
  insert into public.material_views (material_id, viewer_key, viewer_id)
  values (p_material_id, p_viewer_key, p_viewer_id)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted > 0 then
    update public.study_materials set views_count = views_count + 1 where id = p_material_id;
    return true;
  end if;
  return false;
end;
$$;
revoke execute on function public.record_material_view(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.record_material_view(uuid, text, uuid) to service_role;

-- Denúncias --------------------------------------------------------------------------
create table public.material_reports (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.study_materials (id) on delete cascade,
  reporter_id uuid references public.profiles (id) on delete set null,
  reason public.report_reason not null,
  details text check (details is null or char_length(details) <= 2000),
  status public.report_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.material_reports enable row level security;
create unique index material_reports_one_open_per_user on public.material_reports (material_id, reporter_id)
  where status = 'open';
create index material_reports_status_idx on public.material_reports (status, created_at desc);
create policy "material_reports: denunciante vê as próprias" on public.material_reports
  for select to authenticated using (reporter_id = (select auth.uid()) or public.is_moderator());
create policy "material_reports: denuncia material visível" on public.material_reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (select 1 from public.study_materials m where m.id = material_id and m.author_id <> (select auth.uid()))
  );
revoke update, delete on public.material_reports from authenticated;
revoke insert on public.material_reports from authenticated;
grant insert (material_id, reporter_id, reason, details) on public.material_reports to authenticated;
create trigger material_reports_updated_at before update on public.material_reports
  for each row execute function public.set_updated_at();

-- Material com muitas denúncias abertas sai do ar até a revisão.
create or replace function public.material_reports_auto_hide()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_open integer;
begin
  select count(distinct reporter_id) into v_open
    from public.material_reports
   where material_id = new.material_id and status = 'open';
  if v_open >= public.setting_int('report_auto_hide_threshold', 3) then
    update public.study_materials
       set status = 'pending_review',
           moderation_note = 'Em revisão após denúncias da comunidade.'
     where id = new.material_id and status = 'published';
  end if;
  return new;
end;
$$;
create trigger material_reports_auto_hide after insert on public.material_reports
  for each row execute function public.material_reports_auto_hide();

-- Busca na biblioteca ----------------------------------------------------------------
create or replace function public.search_materials(
  p_query text default null,
  p_subject_id uuid default null,
  p_school_stage public.school_stage default null,
  p_grade_year smallint default null,
  p_material_type public.material_type default null,
  p_topic text default null,
  p_sort text default 'relevance',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  title text,
  description text,
  subject_id uuid,
  school_stage public.school_stage,
  grade_year smallint,
  topic text,
  tags text[],
  material_type public.material_type,
  author_id uuid,
  published_at timestamptz,
  views_count integer,
  favorites_count integer,
  saves_count integer,
  rating_sum integer,
  rating_count integer,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select case when nullif(btrim(coalesce(p_query, '')), '') is null then null
                else websearch_to_tsquery('public.portuguese_unaccent'::regconfig, p_query) end as query,
           nullif(btrim(coalesce(p_query, '')), '') as raw
  ),
  base as (
    select m.*,
           case when q.query is null then 0
                else ts_rank_cd(m.search_vector, q.query)
                     + extensions.similarity(public.immutable_unaccent(lower(m.title)),
                                             public.immutable_unaccent(lower(q.raw))) end as score
    from public.study_materials m, q
    where m.status = 'published'
      and m.visibility = 'public'
      and (p_subject_id is null or m.subject_id = p_subject_id)
      and (p_school_stage is null or m.school_stage = p_school_stage)
      and (p_grade_year is null or m.grade_year = p_grade_year)
      and (p_material_type is null or m.material_type = p_material_type)
      and (p_topic is null or public.immutable_unaccent(lower(m.topic)) like
             '%' || public.immutable_unaccent(lower(p_topic)) || '%')
      and (q.query is null
           or m.search_vector @@ q.query
           or extensions.similarity(public.immutable_unaccent(lower(m.title)),
                                    public.immutable_unaccent(lower(q.raw))) > 0.3)
  )
  select b.id, b.slug, b.title, b.description, b.subject_id, b.school_stage, b.grade_year, b.topic,
         b.tags, b.material_type, b.author_id, b.published_at, b.views_count, b.favorites_count,
         b.saves_count, b.rating_sum, b.rating_count,
         count(*) over () as total_count
  from base b
  order by
    case when p_sort = 'relevance' then b.score end desc nulls last,
    case when p_sort = 'saves' then b.saves_count + b.favorites_count end desc nulls last,
    case when p_sort = 'views' then b.views_count end desc nulls last,
    case when p_sort = 'rating' then (b.rating_sum::numeric / nullif(b.rating_count, 0)) end desc nulls last,
    b.published_at desc nulls last,
    b.id
  limit least(greatest(p_limit, 1), 60)
  offset greatest(p_offset, 0);
$$;
grant execute on function public.search_materials(text, uuid, public.school_stage, smallint, public.material_type, text, text, integer, integer)
  to anon, authenticated;

create or replace function public.related_materials(p_material_id uuid, p_limit integer default 6)
returns setof public.study_materials
language sql
stable
security invoker
set search_path = ''
as $$
  select m.*
  from public.study_materials m
  join public.study_materials ref on ref.id = p_material_id
  where m.id <> ref.id
    and m.status = 'published'
    and m.visibility = 'public'
    and m.subject_id = ref.subject_id
  order by
    cardinality(array(select unnest(m.tags) intersect select unnest(ref.tags))) desc,
    (m.topic is not distinct from ref.topic) desc,
    (m.school_stage is not distinct from ref.school_stage) desc,
    m.saves_count + m.favorites_count desc,
    m.published_at desc
  limit least(greatest(p_limit, 1), 12);
$$;
grant execute on function public.related_materials(uuid, integer) to anon, authenticated;

-- Mensagens de contato, pedidos de titulares (LGPD) e notificações de direitos autorais.
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  topic text not null check (topic in ('support', 'privacy', 'copyright', 'report', 'partnership', 'other')),
  message text not null check (char_length(btrim(message)) between 10 and 5000),
  reference_url text check (reference_url is null or char_length(reference_url) <= 500),
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
create index contact_messages_status_idx on public.contact_messages (status, created_at desc);
create trigger contact_messages_updated_at before update on public.contact_messages
  for each row execute function public.set_updated_at();
