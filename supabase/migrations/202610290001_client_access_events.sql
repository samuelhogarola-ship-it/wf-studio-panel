begin;

create table public.client_access_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type = 'password_changed_by_client'),
  created_at timestamptz not null default now()
);

create index client_access_events_client_date_idx
  on public.client_access_events (client_id, created_at desc);

alter table public.client_access_events enable row level security;

create policy client_access_events_admin_read on public.client_access_events
  for select to authenticated
  using (private.is_admin());

create policy client_access_events_client_insert on public.client_access_events
  for insert to authenticated
  with check (
    auth.uid() = auth_user_id
    and event_type = 'password_changed_by_client'
    and exists (
      select 1
      from public.clients c
      where c.id = client_id
        and c.project = 'wf-studio'
        and c.status = 'active'
        and lower(c.email) = lower(auth.jwt() ->> 'email')
    )
  );

revoke all on public.client_access_events from public, anon, authenticated;
grant select, insert on public.client_access_events to authenticated;

commit;
