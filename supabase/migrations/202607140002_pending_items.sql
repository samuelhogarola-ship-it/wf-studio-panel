create table if not exists public.pending_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'received')),
  requested_at date not null default current_date,
  received_at date,
  reminder_interval_days integer,
  next_reminder_at date,
  last_reminder_sent_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.pending_items
drop constraint if exists pending_items_reminder_interval_days_positive;

alter table public.pending_items
add constraint pending_items_reminder_interval_days_positive
check (reminder_interval_days is null or reminder_interval_days >= 1);

create index if not exists pending_items_client_status_idx
on public.pending_items (client_id, status, sort_order, requested_at desc);

drop trigger if exists set_pending_items_updated_at on public.pending_items;
create trigger set_pending_items_updated_at
before update on public.pending_items
for each row
execute function public.set_updated_at();

alter table public.pending_items enable row level security;

drop policy if exists pending_items_admin_all on public.pending_items;
create policy pending_items_admin_all on public.pending_items
for all
using (private.is_admin())
with check (private.is_admin());

drop policy if exists pending_items_client_select_own on public.pending_items;
create policy pending_items_client_select_own on public.pending_items
for select
using (
  client_id = private.current_client_id()
);
