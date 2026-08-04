create extension if not exists pgcrypto;

create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'client' check (role in ('admin', 'client')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  email text not null,
  phone text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.packs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  hours_total numeric not null,
  price numeric,
  invoice_number text,
  purchase_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint packs_hours_total_positive check (hours_total > 0)
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  pack_id uuid not null references public.packs(id) on delete restrict,
  activity_type text not null,
  title text not null,
  description text,
  hours_used numeric not null check (hours_used > 0),
  work_date date not null default current_date,
  notify_client boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete set null,
  title text not null,
  body text,
  hours_delta numeric,
  remaining_hours numeric,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists clients_email_lower_unique_idx on public.clients (lower(email));
create index if not exists packs_client_status_purchase_idx on public.packs (client_id, status, purchase_date desc);
create index if not exists activities_client_pack_work_idx on public.activities (client_id, pack_id, work_date desc);
create index if not exists notifications_client_created_idx on public.notifications (client_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_clients_updated_at on public.clients;
create trigger set_clients_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

drop trigger if exists set_packs_updated_at on public.packs;
create trigger set_packs_updated_at
before update on public.packs
for each row
execute function public.set_updated_at();

drop trigger if exists set_activities_updated_at on public.activities;
create trigger set_activities_updated_at
before update on public.activities
for each row
execute function public.set_updated_at();

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'client')
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_auth_user_created();

create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update of email on auth.users
for each row
execute function public.handle_auth_user_updated();

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function private.current_client_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce((auth.jwt() ->> 'email'), ''));
$$;

create or replace function private.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.clients c
  where lower(c.email) = private.current_client_email()
  limit 1;
$$;

create or replace function public.ensure_pack_active()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  pack_status text;
  pack_client_id uuid;
begin
  select status, client_id
  into pack_status, pack_client_id
  from public.packs
  where id = new.pack_id;

  if pack_status is null then
    raise exception 'Pack no encontrado';
  end if;

  if pack_status <> 'active' then
    raise exception 'No se pueden registrar actividades sobre packs inactivos';
  end if;

  if pack_client_id <> new.client_id then
    raise exception 'La actividad debe pertenecer al mismo cliente que el pack';
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_pack_active_before_activity on public.activities;
create trigger ensure_pack_active_before_activity
before insert or update on public.activities
for each row
execute function public.ensure_pack_active();

create or replace view public.client_summary
with (security_invoker = true)
as
select
  c.id as client_id,
  c.name as client_name,
  c.email as client_email,
  coalesce(sum(case when p.status = 'active' then p.hours_total else 0 end), 0)::numeric as total_hours,
  coalesce(sum(a.hours_used), 0)::numeric as used_hours,
  (
    coalesce(sum(case when p.status = 'active' then p.hours_total else 0 end), 0)
    - coalesce(sum(a.hours_used), 0)
  )::numeric as remaining_hours
from public.clients c
left join public.packs p on p.client_id = c.id
left join public.activities a on a.client_id = c.id
group by c.id, c.name, c.email;

create or replace view public.pack_summary
with (security_invoker = true)
as
select
  p.id as pack_id,
  p.client_id,
  p.name as pack_name,
  p.hours_total::numeric as hours_total,
  coalesce(sum(a.hours_used), 0)::numeric as used_hours,
  (p.hours_total - coalesce(sum(a.hours_used), 0))::numeric as remaining_hours
from public.packs p
left join public.activities a on a.pack_id = p.id
group by p.id, p.client_id, p.name, p.hours_total;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.packs enable row level security;
alter table public.activities enable row level security;
alter table public.notifications enable row level security;

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
for all
using (private.is_admin())
with check (private.is_admin());

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
for select
using (id = auth.uid());

drop policy if exists clients_admin_all on public.clients;
create policy clients_admin_all on public.clients
for all
using (private.is_admin())
with check (private.is_admin());

drop policy if exists clients_client_select_own on public.clients;
create policy clients_client_select_own on public.clients
for select
using (
  lower(email) = private.current_client_email()
  and status = 'active'
);

drop policy if exists packs_admin_all on public.packs;
create policy packs_admin_all on public.packs
for all
using (private.is_admin())
with check (private.is_admin());

drop policy if exists packs_client_select_own on public.packs;
create policy packs_client_select_own on public.packs
for select
using (
  client_id = private.current_client_id()
);

drop policy if exists activities_admin_all on public.activities;
create policy activities_admin_all on public.activities
for all
using (private.is_admin())
with check (private.is_admin());

drop policy if exists activities_client_select_own on public.activities;
create policy activities_client_select_own on public.activities
for select
using (
  client_id = private.current_client_id()
);

drop policy if exists notifications_admin_all on public.notifications;
create policy notifications_admin_all on public.notifications
for all
using (private.is_admin())
with check (private.is_admin());

drop policy if exists notifications_client_select_own on public.notifications;
create policy notifications_client_select_own on public.notifications
for select
using (
  client_id = private.current_client_id()
);

grant select on public.client_summary to authenticated;
grant select on public.pack_summary to authenticated;
