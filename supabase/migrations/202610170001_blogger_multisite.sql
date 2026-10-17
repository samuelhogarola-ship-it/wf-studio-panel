create table if not exists public.blogger_site_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_key text not null check (site_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, site_key)
);
alter table public.blogger_site_memberships enable row level security;
create policy blogger_site_memberships_admin_all on public.blogger_site_memberships for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy blogger_site_memberships_own_read on public.blogger_site_memberships for select to authenticated using (user_id = auth.uid());
revoke all on public.blogger_site_memberships from anon;
grant select on public.blogger_site_memberships to authenticated;
grant all on public.blogger_site_memberships to service_role;
