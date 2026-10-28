-- Comunidade (fase 5): histórico de publicação, privacidade de perfis e resumo das pastas.

-- Consentimento de responsável não pode ser consultado sobre outras pessoas: com
-- security definer, qualquer visitante descobria quais contas são de menores.
-- Como invoker, o RLS de guardian_consents só deixa cada um ver o próprio.
alter function public.has_guardian_consent(uuid) security invoker;

-- Histórico de status de cada material ------------------------------------------------
create table public.material_events (
  id bigint generated always as identity primary key,
  material_id uuid not null references public.study_materials (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  event text not null check (event in (
    'created', 'submitted', 'published', 'returned_to_review', 'rejected', 'removed', 'withdrawn', 'restored'
  )),
  from_status public.material_status,
  to_status public.material_status not null,
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
alter table public.material_events enable row level security;
create index material_events_material_idx on public.material_events (material_id, created_at desc);
create policy "material_events: autor e moderação leem" on public.material_events
  for select to authenticated
  using (
    public.is_moderator()
    or exists (select 1 from public.study_materials m where m.id = material_id and m.author_id = (select auth.uid()))
  );
-- Quem moderou não é revelado ao autor (evita perseguição a moderadores).
revoke all on public.material_events from anon, authenticated;
grant select (id, material_id, event, from_status, to_status, note, created_at) on public.material_events to authenticated;

create or replace function public.study_materials_log_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
begin
  if tg_op = 'INSERT' then
    insert into public.material_events (material_id, actor_id, event, from_status, to_status)
    values (new.id, (select auth.uid()), 'created', null, new.status);
    return new;
  end if;
  if new.status is not distinct from old.status then
    return new;
  end if;
  v_event := case new.status
    when 'pending_review' then case when old.status = 'published' then 'returned_to_review' else 'submitted' end
    when 'published' then case when old.status = 'removed' then 'restored' else 'published' end
    when 'rejected' then 'rejected'
    when 'removed' then 'removed'
    else 'withdrawn'
  end;
  insert into public.material_events (material_id, actor_id, event, from_status, to_status, note)
  values (
    new.id, (select auth.uid()), v_event, old.status, new.status,
    case when new.moderation_note is distinct from old.moderation_note then new.moderation_note end
  );
  return new;
end;
$$;
create trigger study_materials_log_status after insert or update on public.study_materials
  for each row execute function public.study_materials_log_status();

-- Histórico dos materiais que já existiam.
insert into public.material_events (material_id, actor_id, event, from_status, to_status, created_at)
select m.id, m.author_id, 'created', null, m.status, m.created_at
  from public.study_materials m
 where not exists (select 1 from public.material_events e where e.material_id = m.id);

-- Busca de perfis --------------------------------------------------------------------
-- Só aparecem perfis públicos ou pessoas que já assinam materiais públicos (o @ delas
-- já é visível na biblioteca). Curingas do LIKE digitados na busca são escapados.
create or replace function public.search_profiles(p_query text, p_limit integer default 20)
returns table (username text, display_name text, avatar_url text, materials_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select btrim(coalesce(p_query, '')) as raw,
           replace(replace(replace(lower(btrim(coalesce(p_query, ''))), '\', '\\'), '%', '\%'), '_', '\_') as pattern
  ),
  candidates as (
    select p.username, p.display_name, p.avatar_url, p.profile_visibility,
           (select count(*) from public.study_materials m
             where m.author_id = p.id and m.status = 'published' and m.visibility = 'public') as materials
      from public.profiles p, q
     where p.account_status = 'active'
       and char_length(q.raw) >= 2
       and (
         p.username like '%' || q.pattern || '%'
         or (p.profile_visibility = 'public'
             and public.immutable_unaccent(lower(p.display_name)) like '%' || public.immutable_unaccent(q.pattern) || '%')
       )
  )
  select c.username,
         case when c.profile_visibility = 'public' then c.display_name end,
         case when c.profile_visibility = 'public' then c.avatar_url end,
         c.materials
    from candidates c
   where c.profile_visibility = 'public' or c.materials > 0
   order by c.materials desc, c.username
   limit least(greatest(p_limit, 1), 50);
$$;
grant execute on function public.search_profiles(text, integer) to anon, authenticated;

-- Perfil privado mostra só o @ e os materiais públicos: conquistas e data de entrada
-- passam a depender também do perfil ser público.
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
    'member_since', case when p.profile_visibility = 'public' then p.created_at end,
    'subjects', case when p.profile_visibility = 'public' then coalesce((
        select jsonb_agg(jsonb_build_object('slug', s.slug, 'name', s.name, 'color', s.color) order by s.sort_order)
          from public.user_subjects us join public.subjects s on s.id = us.subject_id
         where us.user_id = p.id), '[]'::jsonb) else '[]'::jsonb end,
    'stats', case when p.profile_visibility = 'public' and p.show_stats_publicly then (
        select jsonb_build_object('level', st.level, 'xp_total', st.xp_total, 'longest_streak', st.longest_streak)
          from public.user_stats st where st.user_id = p.id) end,
    'achievements', case when p.profile_visibility = 'public' and p.show_achievements_publicly then coalesce((
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

-- Pastas -----------------------------------------------------------------------------
create index flashcard_decks_folder_idx on public.flashcard_decks (folder_id) where folder_id is not null;
create index quizzes_folder_idx on public.quizzes (folder_id) where folder_id is not null;
create index ai_conversations_folder_idx on public.ai_conversations (folder_id) where folder_id is not null;
create index material_saves_folder_idx on public.material_saves (folder_id) where folder_id is not null;

-- Resumo das pastas do usuário com a contagem de itens de cada tipo (RLS de cada tabela vale).
create or replace function public.folder_summaries()
returns table (
  id uuid,
  name text,
  color text,
  subject_id uuid,
  exam_date date,
  created_at timestamptz,
  files_count bigint,
  generations_count bigint,
  decks_count bigint,
  quizzes_count bigint,
  conversations_count bigint,
  saved_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select f.id, f.name, f.color, f.subject_id, f.exam_date, f.created_at,
         (select count(*) from public.uploaded_files x
           where x.folder_id = f.id and x.purpose = 'study' and x.status <> 'pending_upload'),
         (select count(*) from public.ai_generations x where x.folder_id = f.id and x.status = 'completed'),
         (select count(*) from public.flashcard_decks x where x.folder_id = f.id),
         (select count(*) from public.quizzes x where x.folder_id = f.id),
         (select count(*) from public.ai_conversations x where x.folder_id = f.id),
         (select count(*) from public.material_saves x where x.folder_id = f.id and x.kind = 'saved')
    from public.folders f
   where f.user_id = (select auth.uid())
   order by f.exam_date nulls last, lower(f.name);
$$;
revoke execute on function public.folder_summaries() from public, anon;
grant execute on function public.folder_summaries() to authenticated;
