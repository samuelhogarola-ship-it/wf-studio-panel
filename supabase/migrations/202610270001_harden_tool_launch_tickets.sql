begin;

create index if not exists tool_launch_tickets_subject_rate_idx
on public.tool_launch_tickets (user_id, site_key, created_at);

create or replace function public.create_tool_launch_ticket(
  p_code_hash text,
  p_protocol text,
  p_site_key text,
  p_audience text,
  p_project_id uuid,
  p_client_id uuid,
  p_user_id uuid,
  p_actor_role text
)
returns table(expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || p_site_key, 0)
  );

  delete from public.tool_launch_tickets
  where consumed_at < now() - interval '1 hour'
     or (consumed_at is null and expires_at < now() - interval '1 hour');

  if (
    select count(*)
    from public.tool_launch_tickets
    where user_id = p_user_id
      and site_key = p_site_key
      and created_at > now() - interval '5 minutes'
  ) >= 20 then
    raise exception 'Blogger launch rate limit exceeded' using errcode = 'P0001';
  end if;

  return query
  insert into public.tool_launch_tickets (
    code_hash,
    protocol,
    site_key,
    audience,
    project_id,
    client_id,
    user_id,
    actor_role,
    created_at,
    expires_at
  ) values (
    p_code_hash,
    p_protocol,
    p_site_key,
    p_audience,
    p_project_id,
    p_client_id,
    p_user_id,
    p_actor_role,
    now(),
    now() + interval '60 seconds'
  )
  returning tool_launch_tickets.expires_at;
end;
$$;

revoke all on function public.create_tool_launch_ticket(text, text, text, text, uuid, uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.create_tool_launch_ticket(text, text, text, text, uuid, uuid, uuid, text)
to service_role;

commit;
