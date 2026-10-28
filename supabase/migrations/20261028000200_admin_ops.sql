-- Operação (fase 7): virada semanal das ligas, busca de usuários para a administração,
-- limpeza de envios abandonados e índices para as filas de moderação.

-- Virada das ligas uma única vez por semana, com a lista de quem mudou (para avisar).
create table public.league_rollovers (
  week_start date primary key,
  changed integer not null default 0,
  processed_at timestamptz not null default now()
);
alter table public.league_rollovers enable row level security;

create or replace function public.run_league_rollover(p_week_start date)
returns table (user_id uuid, old_league text, new_league text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
  v_changed integer;
begin
  -- A semana precisa ter terminado e só pode ser processada uma vez.
  if p_week_start >= public.leaderboard_week_start() then
    raise exception 'A semana % ainda não terminou.', p_week_start using errcode = 'P0001';
  end if;
  insert into public.league_rollovers (week_start) values (p_week_start) on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return;
  end if;

  return query
  with ranked as (
    select e.user_id, e.league, e.xp,
           row_number() over (partition by e.league order by e.xp desc, e.updated_at asc) as pos,
           count(*) over (partition by e.league) as total
      from public.leaderboard_entries e
     where e.week_start = p_week_start
  ),
  moves as (
    select r.user_id, r.league as old_league,
           case
             when r.xp > 0 and r.pos <= greatest(1, ceil(r.total * 0.2)) then
               case r.league when 'bronze' then 'prata' when 'prata' then 'ouro' when 'ouro' then 'platina' else 'diamante' end
             when r.total >= 5 and r.pos > r.total - floor(r.total * 0.2) then
               case r.league when 'diamante' then 'platina' when 'platina' then 'ouro' when 'ouro' then 'prata' else 'bronze' end
             else r.league
           end as new_league
      from ranked r
  ),
  updated as (
    update public.user_stats s
       set league = m.new_league, updated_at = now()
      from moves m
     where s.user_id = m.user_id and s.league <> m.new_league
    returning s.user_id, m.old_league, m.new_league
  )
  select u.user_id, u.old_league, u.new_league from updated u;
  get diagnostics v_changed = row_count;

  update public.league_rollovers set changed = v_changed where week_start = p_week_start;
end;
$$;
revoke execute on function public.run_league_rollover(date) from public, anon, authenticated;
grant execute on function public.run_league_rollover(date) to service_role;

-- Busca de usuários para a administração (e-mail vem de auth.users; só a chave do servidor).
create or replace function public.admin_find_users(p_query text, p_limit integer default 30)
returns table (
  id uuid,
  email text,
  username text,
  display_name text,
  account_status public.account_status,
  birth_date date,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  roles text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select lower(btrim(coalesce(p_query, ''))) as raw,
           replace(replace(replace(lower(btrim(coalesce(p_query, ''))), '\', '\\'), '%', '\%'), '_', '\_') as pattern
  )
  select p.id, u.email::text, p.username, p.display_name, p.account_status, p.birth_date, p.created_at, u.last_sign_in_at,
         coalesce((select array_agg(r.role::text order by r.role) from public.user_roles r where r.user_id = p.id), '{}')
    from public.profiles p
    join auth.users u on u.id = p.id, q
   where q.raw = ''
      or p.id::text = q.raw
      or p.username like '%' || q.pattern || '%'
      or lower(u.email) like '%' || q.pattern || '%'
      or public.immutable_unaccent(lower(p.display_name)) like '%' || public.immutable_unaccent(q.pattern) || '%'
   order by p.created_at desc
   limit least(greatest(p_limit, 1), 100);
$$;
revoke execute on function public.admin_find_users(text, integer) from public, anon, authenticated;
grant execute on function public.admin_find_users(text, integer) to service_role;

-- Envios abandonados (nunca concluídos) e imagens do chat que não estão em nenhuma
-- mensagem (conversa excluída, envio cancelado). Devolve os caminhos para apagar do Storage.
create or replace function public.purge_orphan_uploads(p_older_than interval default interval '1 day')
returns table (storage_path text)
language sql
security definer
set search_path = ''
as $$
  with doomed as (
    delete from public.uploaded_files f
     where f.created_at < now() - p_older_than
       and (
         f.status = 'pending_upload'
         or (f.purpose = 'chat' and not exists (
               select 1 from public.ai_messages m
                where m.user_id = f.user_id
                  and m.attachments @> jsonb_build_array(jsonb_build_object('fileId', f.id::text))))
       )
       and not exists (select 1 from public.study_materials s where s.file_id = f.id)
    returning f.storage_path
  )
  select d.storage_path from doomed d;
$$;
revoke execute on function public.purge_orphan_uploads(interval) from public, anon, authenticated;
grant execute on function public.purge_orphan_uploads(interval) to service_role;

-- Notificações lidas há mais de 180 dias saem junto com a limpeza diária.
create or replace function public.purge_old_notifications()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.notifications where read_at is not null and read_at < now() - interval '180 days' returning 1
  )
  select count(*)::integer from gone;
$$;
revoke execute on function public.purge_old_notifications() from public, anon, authenticated;
grant execute on function public.purge_old_notifications() to service_role;

-- Filas da moderação.
create index study_materials_pending_idx on public.study_materials (updated_at) where status = 'pending_review';
create index contact_messages_open_idx on public.contact_messages (created_at desc) where status <> 'closed';
create index notifications_type_idx on public.notifications (user_id, type, created_at desc);
