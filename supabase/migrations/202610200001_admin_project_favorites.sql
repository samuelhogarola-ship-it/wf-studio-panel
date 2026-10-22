begin;

create table if not exists public.admin_project_favorites (
  admin_user_id uuid not null,
  project_id uuid not null references public.client_projects(id) on delete cascade,
  position integer,
  created_at timestamptz not null default now(),
  primary key (admin_user_id, project_id)
);

create index if not exists admin_project_favorites_owner_order_idx
on public.admin_project_favorites (admin_user_id, position, created_at);

alter table public.admin_project_favorites enable row level security;

drop policy if exists admin_project_favorites_owner_all on public.admin_project_favorites;
create policy admin_project_favorites_owner_all on public.admin_project_favorites
for all to authenticated
using (auth.uid() = admin_user_id and private.is_admin())
with check (auth.uid() = admin_user_id and private.is_admin());

revoke all on public.admin_project_favorites from public, anon, authenticated;
grant select, insert, update, delete on public.admin_project_favorites to authenticated;

commit;
