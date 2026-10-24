begin;

-- Client ownership is derived from the authenticated portal membership. Clients
-- may submit outbound messages, but they cannot mutate messages after insert.
drop policy if exists messages_client_select_own on public.messages;
create policy messages_client_select_own on public.messages
for select to authenticated
using (client_id = private.current_portal_client_id());

create or replace function private.can_reply_to_message(p_reply_to_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.messages parent
    where parent.id = p_reply_to_id
      and parent.client_id = private.current_portal_client_id()
      and parent.direction = 'inbound'
  );
$$;

revoke all on function private.can_reply_to_message(uuid) from public, anon;
grant execute on function private.can_reply_to_message(uuid) to authenticated;

drop policy if exists messages_client_insert_own on public.messages;
create policy messages_client_insert_own on public.messages
for insert to authenticated
with check (
  client_id = private.current_portal_client_id()
  and direction = 'outbound'
  and (
    reply_to_id is null
    or private.can_reply_to_message(reply_to_id)
  )
);

drop policy if exists messages_client_update_own on public.messages;

create or replace function private.prevent_ownership_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.client_id is distinct from new.client_id then
    raise exception 'Client ownership is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_client_id_immutable on public.messages;
create trigger messages_client_id_immutable
before update on public.messages
for each row execute function private.prevent_ownership_change();

drop trigger if exists client_resources_client_id_immutable on public.client_resources;
create trigger client_resources_client_id_immutable
before update on public.client_resources
for each row execute function private.prevent_ownership_change();

revoke all on function private.prevent_ownership_change() from public, anon, authenticated;

create or replace function public.mark_message_read(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_client_id uuid := private.current_portal_client_id();
begin
  if v_client_id is null then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  update public.messages
  set read_at = coalesce(read_at, timezone('utc', now()))
  where id = p_message_id
    and client_id = v_client_id
    and direction = 'inbound'
    and read_at is null;
end;
$$;

revoke all on function public.mark_message_read(uuid) from public, anon;
grant execute on function public.mark_message_read(uuid) to authenticated;

drop policy if exists client_resources_own_read on public.client_resources;
create policy client_resources_own_read on public.client_resources
for select to authenticated
using (client_id = private.current_portal_client_id());

drop policy if exists client_resources_own_write on public.client_resources;
drop policy if exists client_resources_admin_all on public.client_resources;
create policy client_resources_admin_all on public.client_resources
for all to authenticated
using (private.is_admin())
with check (private.is_admin());

commit;
