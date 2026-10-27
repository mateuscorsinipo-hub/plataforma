-- Assinaturas, consumo, limites de requisição, auditoria administrativa e criação de perfis.

create table public.billing_customers (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('stripe')),
  provider_customer_id text not null unique,
  created_at timestamptz not null default now()
);
alter table public.billing_customers enable row level security;

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('stripe', 'manual')),
  provider_subscription_id text unique,
  plan_id text not null check (plan_id ~ '^[a-z_]{2,30}$'),
  status public.subscription_status not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create index subscriptions_user_idx on public.subscriptions (user_id, status);
create policy "subscriptions: dono lê" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.subscriptions from authenticated;
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Eventos de webhook já processados (idempotência). Guarda só o necessário.
create table public.billing_events (
  id text primary key,
  provider text not null,
  type text not null,
  object_id text,
  processed_at timestamptz,
  error text check (error is null or char_length(error) <= 500),
  created_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;

create table public.usage_records (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  feature text not null check (feature ~ '^[a-z_]{3,40}$'),
  quantity integer not null default 1 check (quantity between 1 and 100000),
  period_key text not null check (char_length(period_key) <= 20),
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
alter table public.usage_records enable row level security;
create index usage_records_lookup_idx on public.usage_records (user_id, feature, period_key);
create index usage_records_user_idx on public.usage_records (user_id, created_at desc);
create policy "usage_records: dono lê" on public.usage_records
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.usage_records from authenticated;

-- Reserva atômica de consumo: verifica o limite do período e registra em uma só transação.
-- O limite vem da configuração central de planos no servidor.
create or replace function public.consume_usage(
  p_user_id uuid,
  p_feature text,
  p_quantity integer,
  p_limit integer,
  p_period_key text,
  p_metadata jsonb default '{}'
)
returns table (allowed boolean, used integer, record_id bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used integer;
  v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':usage:' || p_feature, 0));
  select coalesce(sum(quantity), 0) into v_used
    from public.usage_records
   where user_id = p_user_id and feature = p_feature and period_key = p_period_key;
  if p_limit is not null and v_used + p_quantity > p_limit then
    return query select false, v_used, null::bigint;
    return;
  end if;
  insert into public.usage_records (user_id, feature, quantity, period_key, metadata)
  values (p_user_id, p_feature, p_quantity, p_period_key, coalesce(p_metadata, '{}'))
  returning id into v_id;
  return query select true, v_used + p_quantity, v_id;
end;
$$;
revoke execute on function public.consume_usage(uuid, text, integer, integer, text, jsonb) from public, anon, authenticated;
grant execute on function public.consume_usage(uuid, text, integer, integer, text, jsonb) to service_role;

-- Limite de requisições por chave em janela fixa.
create table public.rate_limits (
  key text not null check (char_length(key) <= 200),
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;

create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into public.rate_limits (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

create or replace function public.purge_expired_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rate integer;
  v_views integer;
  v_consents integer;
begin
  delete from public.rate_limits where window_start < now() - interval '2 days';
  get diagnostics v_rate = row_count;
  delete from public.material_views where viewed_on < current_date - 90;
  get diagnostics v_views = row_count;
  update public.guardian_consents set status = 'expired' where status = 'pending' and expires_at < now();
  get diagnostics v_consents = row_count;
  return jsonb_build_object('rate_limits', v_rate, 'material_views', v_views, 'expired_consents', v_consents);
end;
$$;
revoke execute on function public.purge_expired_data() from public, anon, authenticated;
grant execute on function public.purge_expired_data() to service_role;

-- Auditoria administrativa (só o servidor lê e escreve).
create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  target_type text not null check (char_length(target_type) <= 40),
  target_id text check (target_id is null or char_length(target_id) <= 120),
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);
alter table public.admin_audit_logs enable row level security;
create index admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);
create index admin_audit_logs_target_idx on public.admin_audit_logs (target_type, target_id);

-- Criação automática de perfil, preferências e estatísticas no cadastro ---------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_birth date;
  v_base text;
  v_username text;
  v_try integer := 0;
  v_accepted boolean := coalesce(new.raw_user_meta_data ->> 'accepted_terms', 'false') = 'true';
begin
  v_name := left(btrim(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, ''), '@', 1), 'Estudante')), 60);
  if v_name = '' then
    v_name := 'Estudante';
  end if;

  begin
    v_birth := (new.raw_user_meta_data ->> 'birth_date')::date;
  exception when others then
    v_birth := null;
  end;
  if v_birth is not null and (v_birth > current_date or v_birth < date '1900-01-01') then
    v_birth := null;
  end if;

  v_base := lower(regexp_replace(public.immutable_unaccent(v_name), '[^a-zA-Z0-9]+', '', 'g'));
  v_base := left(coalesce(nullif(v_base, ''), 'estudante'), 16);
  if char_length(v_base) < 3 then
    v_base := v_base || 'aluno';
  end if;
  loop
    v_username := v_base || lpad((floor(random() * 10000))::integer::text, 4, '0');
    exit when not exists (select 1 from public.profiles where username = v_username);
    v_try := v_try + 1;
    if v_try > 20 then
      v_username := left(v_base, 12) || substr(replace(new.id::text, '-', ''), 1, 10);
      exit;
    end if;
  end loop;

  insert into public.profiles (id, username, display_name, birth_date, terms_accepted_at, privacy_accepted_at)
  values (new.id, v_username, v_name, v_birth,
          case when v_accepted then now() end,
          case when v_accepted then now() end);
  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  insert into public.user_stats (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
