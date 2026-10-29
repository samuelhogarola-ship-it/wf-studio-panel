begin;

create table public.platform_requests (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('vivir-fuengirola', 'vivir-fuengirola-negocios', 'conoce-fuengirola')),
  request_type text not null check (request_type in ('client', 'business', 'subscription_interest')),
  name text not null,
  email text not null,
  phone text,
  company text,
  profile_data jsonb not null default '{}'::jsonb check (jsonb_typeof(profile_data) = 'object'),
  message text,
  source_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  converted_client_id uuid references public.clients(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email = lower(btrim(email)))
);

create unique index platform_requests_pending_fingerprint_unique_idx
on public.platform_requests (fingerprint)
where status = 'pending';

create index platform_requests_platform_status_created_idx
on public.platform_requests (platform, status, created_at desc);

create trigger set_platform_requests_updated_at
before update on public.platform_requests
for each row execute function public.set_updated_at();

alter table public.platform_requests enable row level security;

revoke all on table public.platform_requests from public, anon, authenticated;
grant select on table public.platform_requests to authenticated;

create policy platform_requests_admin_select
on public.platform_requests
for select to authenticated
using (private.is_admin());

create or replace function public.approve_platform_request(p_request_id uuid)
returns table (outcome text, client_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.platform_requests%rowtype;
  v_project text;
  v_client_id uuid;
  v_created boolean := false;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if to_regclass('public.clients_project_email_lower_unique_idx') is null then
    raise exception 'Client project email uniqueness is unavailable';
  end if;

  select *
  into v_request
  from public.platform_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Platform request not found' using errcode = 'P0002';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Platform request is already resolved' using errcode = 'P0001';
  end if;

  v_project := case v_request.platform
    when 'vivir-fuengirola' then 'vivir-fuengirola'
    when 'vivir-fuengirola-negocios' then 'vivir-fuengirola-negocios'
    when 'conoce-fuengirola' then 'conoce-fuengirola'
    else null
  end;

  if v_project is null then
    raise exception 'Unsupported platform request';
  end if;

  select id
  into v_client_id
  from public.clients
  where project = v_project
    and lower(email) = lower(v_request.email)
  limit 1;

  if v_client_id is null then
    insert into public.clients (name, company, email, phone, status, project)
    values (
      v_request.name,
      nullif(v_request.company, ''),
      lower(v_request.email),
      nullif(v_request.phone, ''),
      'active',
      v_project
    )
    on conflict (project, lower(email)) do nothing
    returning id into v_client_id;

    if found then
      v_created := true;
    end if;
  end if;

  if v_client_id is null then
    select id
    into v_client_id
    from public.clients
    where project = v_project
      and lower(email) = lower(v_request.email)
    limit 1;
  end if;

  if v_client_id is null then
    raise exception 'Client could not be created or resolved';
  end if;

  update public.platform_requests
  set status = 'approved',
      converted_client_id = v_client_id,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      rejection_reason = null
  where id = p_request_id;

  return query
  select case when v_created then 'created_client' else 'existing_client' end,
         v_client_id;
end;
$$;

create or replace function public.reject_platform_request(p_request_id uuid, p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  update public.platform_requests
  set status = 'rejected',
      rejection_reason = nullif(btrim(p_reason), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id and status = 'pending';

  if not found then
    raise exception 'Platform request not found or already resolved' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

revoke all on function public.approve_platform_request(uuid) from public, anon, authenticated;
grant execute on function public.approve_platform_request(uuid) to authenticated;

revoke all on function public.reject_platform_request(uuid, text) from public, anon, authenticated;
grant execute on function public.reject_platform_request(uuid, text) to authenticated;

commit;
