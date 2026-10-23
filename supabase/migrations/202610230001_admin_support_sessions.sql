begin;

-- Retain audit identity snapshots even when users, clients or projects are removed.
create table public.admin_support_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  client_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  return_path text not null check (
    return_path ~ '^/paneladmin/[a-zA-Z0-9_-]+(/[a-zA-Z0-9_-]+)*$'
    and return_path !~ '[[:cntrl:]]'
  ),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  end_reason text check (end_reason in ('manual', 'expired', 'replaced', 'client_inactive', 'access_revoked')),
  check (expires_at > started_at and expires_at <= started_at + interval '30 minutes'),
  check ((ended_at is null) = (end_reason is null)),
  unique (id, admin_user_id, client_id)
);

create unique index admin_support_sessions_one_unfinished_idx
  on public.admin_support_sessions (admin_user_id) where ended_at is null;
create index admin_support_sessions_owner_client_date_idx
  on public.admin_support_sessions (admin_user_id, client_id, started_at desc);

create table public.admin_support_events (
  id uuid primary key default gen_random_uuid(),
  support_session_id uuid not null,
  admin_user_id uuid not null,
  client_id uuid not null,
  project_id uuid not null,
  capability_key text not null check (capability_key in ('products', 'domains', 'hosting', 'invoices', 'bonuses_reports', 'blogger', 'analytics')),
  scope text not null default 'support_readonly' check (scope = 'support_readonly'),
  created_at timestamptz not null default now(),
  constraint admin_support_events_session_owner_client_fkey
    foreign key (support_session_id, admin_user_id, client_id)
    references public.admin_support_sessions (id, admin_user_id, client_id)
);
create index admin_support_events_owner_date_idx
  on public.admin_support_events (admin_user_id, created_at desc);

alter table public.admin_support_sessions enable row level security;
alter table public.admin_support_events enable row level security;

create policy admin_support_sessions_owner_read on public.admin_support_sessions
  for select to authenticated
  using (auth.uid() = admin_user_id and private.is_admin());
create policy admin_support_events_owner_read on public.admin_support_events
  for select to authenticated
  using (auth.uid() = admin_user_id and private.is_admin());

revoke all on public.admin_support_sessions from public, anon, authenticated, service_role;
revoke all on public.admin_support_events from public, anon, authenticated, service_role;
grant select on public.admin_support_sessions, public.admin_support_events to authenticated;
-- Task 6 will supply the sole event writer: an atomic service-role RPC.

create function public.start_admin_support_session(p_client_id uuid, p_token_hash text, p_return_path text)
returns setof public.admin_support_sessions
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  v_now := clock_timestamp();
  if not exists (select 1 from public.clients c where c.id = p_client_id and c.status = 'active' and c.project = 'wf-studio') then
    raise exception 'Active client required' using errcode = '42501';
  end if;
  if p_return_path is null or p_return_path !~ '^/paneladmin/[a-zA-Z0-9_-]+(/[a-zA-Z0-9_-]+)*$' or p_return_path ~ '[[:cntrl:]]' then
    raise exception 'Invalid return path' using errcode = '22023';
  end if;
  update public.admin_support_sessions
    set ended_at = v_now, end_reason = case when expires_at <= v_now then 'expired' else 'replaced' end
    where admin_user_id = auth.uid() and ended_at is null;
  return query insert into public.admin_support_sessions
    (admin_user_id, client_id, token_hash, return_path, started_at, expires_at)
    values (auth.uid(), p_client_id, p_token_hash, p_return_path, v_now, v_now + interval '30 minutes')
    returning *;
end;
$$;

create function public.end_admin_support_session(p_token_hash text, p_reason text)
returns boolean
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_count integer;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in ('manual', 'expired', 'replaced', 'client_inactive', 'access_revoked') then
    raise exception 'Invalid end reason' using errcode = '22023';
  end if;
  update public.admin_support_sessions
    set ended_at = clock_timestamp(), end_reason = p_reason
    where token_hash = p_token_hash and admin_user_id = auth.uid() and ended_at is null;
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

revoke all on function public.start_admin_support_session(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.end_admin_support_session(text, text) from public, anon, authenticated, service_role;
grant execute on function public.start_admin_support_session(uuid, text, text) to authenticated;
grant execute on function public.end_admin_support_session(text, text) to authenticated;

commit;
