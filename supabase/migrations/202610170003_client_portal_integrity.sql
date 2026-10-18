begin;

-- Account data belongs to the WF Studio client namespace. The historical
-- email-only helper is intentionally left intact for legacy consumers, but no
-- WF Studio account policy may use it now that emails are unique per project.
drop policy if exists clients_client_select_own on public.clients;
create policy clients_client_select_own on public.clients
for select to authenticated
using (id = private.current_portal_client_id());

drop policy if exists packs_client_select_own on public.packs;
create policy packs_client_select_own on public.packs
for select to authenticated
using (client_id = private.current_portal_client_id());

drop policy if exists activities_client_select_own on public.activities;
create policy activities_client_select_own on public.activities
for select to authenticated
using (client_id = private.current_portal_client_id());

drop policy if exists notifications_client_select_own on public.notifications;
create policy notifications_client_select_own on public.notifications
for select to authenticated
using (client_id = private.current_portal_client_id());

drop policy if exists messages_client_select_own on public.messages;
create policy messages_client_select_own on public.messages
for select to authenticated
using (client_id = private.current_portal_client_id());

drop policy if exists messages_client_insert_own on public.messages;
create policy messages_client_insert_own on public.messages
for insert to authenticated
with check (client_id = private.current_portal_client_id());

drop policy if exists messages_client_update_own on public.messages;
create policy messages_client_update_own on public.messages
for update to authenticated
using (client_id = private.current_portal_client_id())
with check (client_id = private.current_portal_client_id());

drop policy if exists services_client_select_own on public.services;
create policy services_client_select_own on public.services
for select to authenticated
using (client_id = private.current_portal_client_id());

drop policy if exists invoices_client_select_own on public.invoices;
create policy invoices_client_select_own on public.invoices
for select to authenticated
using (client_id = private.current_portal_client_id());

drop policy if exists pending_items_client_select_own on public.pending_items;
create policy pending_items_client_select_own on public.pending_items
for select to authenticated
using (client_id = private.current_portal_client_id());

drop policy if exists client_resources_own_read on public.client_resources;
create policy client_resources_own_read on public.client_resources
for select to authenticated
using (client_id = private.current_portal_client_id());

-- One canonical key source feeds both the insert trigger and the migration
-- backfill, preventing their default capability sets from drifting apart.
create or replace function private.project_capability_keys()
returns table(capability_key text)
language sql
immutable
set search_path = ''
as $$
  values
    ('products'),
    ('domains'),
    ('hosting'),
    ('invoices'),
    ('bonuses_reports'),
    ('blogger'),
    ('analytics');
$$;

create or replace function private.ensure_project_capability_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.project_capabilities
    (project_id, capability_key, state, launch_url, metadata, validated_at)
  select new.id, k.capability_key, 'unavailable', null, '{}'::jsonb, null
  from private.project_capability_keys() as k
  on conflict (project_id, capability_key) do nothing;

  return new;
end;
$$;

revoke all on function private.project_capability_keys() from public, anon, authenticated;
revoke all on function private.ensure_project_capability_defaults() from public, anon, authenticated;

drop trigger if exists ensure_project_capability_defaults on public.client_projects;
create trigger ensure_project_capability_defaults
after insert on public.client_projects
for each row execute function private.ensure_project_capability_defaults();

-- Backfill only absent rows for projects created before this trigger. Existing
-- administrator configuration is preserved byte-for-byte.
insert into public.project_capabilities
  (project_id, capability_key, state, launch_url, metadata, validated_at)
select p.id, k.capability_key, 'unavailable', null, '{}'::jsonb, null
from public.client_projects as p
cross join private.project_capability_keys() as k
on conflict (project_id, capability_key) do nothing;

commit;
