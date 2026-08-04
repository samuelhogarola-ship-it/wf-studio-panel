alter table public.clients
drop constraint if exists clients_status_check;

alter table public.clients
add constraint clients_status_check
check (status in ('active', 'inactive', 'pending'));

alter table public.clients
add column if not exists project text not null default 'wf-studio';

alter table public.clients
drop constraint if exists clients_project_check;

alter table public.clients
add constraint clients_project_check
check (project in ('wf-studio', 'vivir-fuengirola', 'conoce-fuengirola'));

alter table public.packs
add column if not exists minutes_total integer;

update public.packs
set minutes_total = coalesce(minutes_total, round(hours_total * 60)::integer)
where minutes_total is null;

alter table public.packs
alter column minutes_total set default 0;

update public.packs
set minutes_total = 0
where minutes_total is null;

alter table public.packs
alter column minutes_total set not null;

alter table public.packs
drop constraint if exists packs_minutes_total_positive;

alter table public.packs
add constraint packs_minutes_total_positive
check (minutes_total >= 0);

alter table public.packs
add column if not exists billing_cycle text not null default 'one_time';

alter table public.packs
drop constraint if exists packs_billing_cycle_check;

alter table public.packs
add constraint packs_billing_cycle_check
check (billing_cycle in ('one_time', 'monthly'));

alter table public.packs
add column if not exists paid boolean not null default false;

alter table public.packs
drop constraint if exists packs_pack_type_check;

alter table public.packs
add constraint packs_pack_type_check
check (pack_type in ('hours', 'tasks', 'domain', 'hosting', 'service', 'subscription', 'membership'));

alter table public.activities
add column if not exists minutes_used integer;

update public.activities
set minutes_used = coalesce(minutes_used, round(hours_used * 60)::integer)
where minutes_used is null;

update public.activities
set minutes_used = 0
where minutes_used is null;

alter table public.activities
alter column minutes_used set not null;

alter table public.activities
drop constraint if exists activities_minutes_used_positive;

alter table public.activities
add constraint activities_minutes_used_positive
check (minutes_used >= 0);

alter table public.notifications
add column if not exists minutes_delta integer;

update public.notifications
set minutes_delta = coalesce(minutes_delta, round(hours_delta * 60)::integer)
where minutes_delta is null and hours_delta is not null;

alter table public.notifications
add column if not exists remaining_minutes integer;

update public.notifications
set remaining_minutes = coalesce(remaining_minutes, round(remaining_hours * 60)::integer)
where remaining_minutes is null and remaining_hours is not null;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  subject text not null,
  body text not null,
  direction text not null default 'outbound' check (direction in ('inbound', 'outbound')),
  type text not null default 'message' check (type in ('message', 'reminder', 'solicitud_servicio', 'solicitud_bono')),
  read_at timestamptz,
  reply_to_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists messages_client_created_idx on public.messages (client_id, created_at desc);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  pack_id uuid references public.packs(id) on delete set null,
  name text not null,
  service_type text not null default 'otro',
  price numeric,
  service_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists services_client_date_idx on public.services (client_id, service_date desc);

drop trigger if exists set_services_updated_at on public.services;
create trigger set_services_updated_at
before update on public.services
for each row
execute function public.set_updated_at();

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  number text not null unique,
  concept text not null,
  amount numeric not null check (amount > 0),
  payment_method text not null default 'transfer' check (payment_method in ('cash', 'card', 'transfer')),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  notes text,
  issued_at date not null default current_date,
  paid_at date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists invoices_client_issued_idx on public.invoices (client_id, issued_at desc);

drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at
before update on public.invoices
for each row
execute function public.set_updated_at();

create or replace function public.next_invoice_number()
returns text
language plpgsql
as $$
declare
  current_year text := to_char(current_date, 'YYYY');
  next_sequence integer;
begin
  select coalesce(max((regexp_match(number, 'WF-' || current_year || '-([0-9]+)$'))[1]::integer), 0) + 1
  into next_sequence
  from public.invoices
  where number like 'WF-' || current_year || '-%';

  return 'WF-' || current_year || '-' || lpad(next_sequence::text, 4, '0');
end;
$$;

create or replace view public.client_summary
with (security_invoker = true)
as
select
  c.id as client_id,
  c.name as client_name,
  c.email as client_email,
  coalesce(pack_totals.total_minutes, 0)::integer as total_minutes,
  coalesce(activity_totals.used_minutes, 0)::integer as used_minutes,
  (coalesce(pack_totals.total_minutes, 0) - coalesce(activity_totals.used_minutes, 0))::integer as remaining_minutes
from public.clients c
left join (
  select
    client_id,
    coalesce(sum(case when status = 'active' then minutes_total else 0 end), 0) as total_minutes
  from public.packs
  group by client_id
) pack_totals on pack_totals.client_id = c.id
left join (
  select
    client_id,
    coalesce(sum(minutes_used), 0) as used_minutes
  from public.activities
  group by client_id
) activity_totals on activity_totals.client_id = c.id;

create or replace view public.pack_summary
with (security_invoker = true)
as
select
  p.id as pack_id,
  p.client_id,
  p.name as pack_name,
  p.pack_type,
  p.minutes_total,
  coalesce(sum(a.minutes_used), 0)::integer as used_minutes,
  (p.minutes_total - coalesce(sum(a.minutes_used), 0))::integer as remaining_minutes
from public.packs p
left join public.activities a on a.pack_id = p.id
group by p.id, p.client_id, p.name, p.pack_type, p.minutes_total;

alter table public.messages enable row level security;
alter table public.services enable row level security;
alter table public.invoices enable row level security;

drop policy if exists messages_admin_all on public.messages;
create policy messages_admin_all on public.messages
for all
using (private.is_admin())
with check (private.is_admin());

drop policy if exists messages_client_select_own on public.messages;
create policy messages_client_select_own on public.messages
for select
using (
  client_id = private.current_client_id()
);

drop policy if exists messages_client_insert_own on public.messages;
create policy messages_client_insert_own on public.messages
for insert
with check (
  client_id = private.current_client_id()
);

drop policy if exists messages_client_update_own on public.messages;
create policy messages_client_update_own on public.messages
for update
using (
  client_id = private.current_client_id()
)
with check (
  client_id = private.current_client_id()
);

drop policy if exists services_admin_all on public.services;
create policy services_admin_all on public.services
for all
using (private.is_admin())
with check (private.is_admin());

drop policy if exists services_client_select_own on public.services;
create policy services_client_select_own on public.services
for select
using (
  client_id = private.current_client_id()
);

drop policy if exists invoices_admin_all on public.invoices;
create policy invoices_admin_all on public.invoices
for all
using (private.is_admin())
with check (private.is_admin());

drop policy if exists invoices_client_select_own on public.invoices;
create policy invoices_client_select_own on public.invoices
for select
using (
  client_id = private.current_client_id()
);

grant select on public.client_summary to authenticated;
grant select on public.pack_summary to authenticated;
grant execute on function public.next_invoice_number() to authenticated;
