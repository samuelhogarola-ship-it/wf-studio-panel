begin;

create table if not exists public.tool_launch_tickets (
  code_hash text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  protocol text not null check (protocol = 'wf-blogger-handoff/v1'),
  site_key text not null check (site_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  audience text not null check (audience ~ '^https://[^/]+$'),
  project_id uuid not null references public.client_projects(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  user_id uuid not null,
  actor_role text not null check (actor_role in ('admin', 'client')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  check (expires_at > created_at),
  check (expires_at <= created_at + interval '60 seconds')
);

create index if not exists tool_launch_tickets_expiry_idx
on public.tool_launch_tickets (expires_at);

alter table public.tool_launch_tickets enable row level security;
alter table public.tool_launch_tickets force row level security;

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
language sql
volatile
security definer
set search_path = ''
as $$
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
$$;

create or replace function public.consume_tool_launch_ticket(
  p_code_hash text,
  p_protocol text,
  p_site_key text,
  p_audience text
)
returns table(
  protocol text,
  site_key text,
  audience text,
  project_id uuid,
  client_id uuid,
  user_id uuid,
  actor_role text,
  expires_at timestamptz
)
language sql
volatile
security definer
set search_path = ''
as $$
  update public.tool_launch_tickets as ticket
  set consumed_at = now()
  where ticket.code_hash = p_code_hash
    and ticket.protocol = p_protocol
    and ticket.site_key = p_site_key
    and ticket.audience = p_audience
    and ticket.consumed_at is null
    and ticket.expires_at > now()
  returning
    ticket.protocol,
    ticket.site_key,
    ticket.audience,
    ticket.project_id,
    ticket.client_id,
    ticket.user_id,
    ticket.actor_role,
    ticket.expires_at;
$$;

revoke all on public.tool_launch_tickets from public, anon, authenticated;
revoke all on function public.create_tool_launch_ticket(text, text, text, text, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.consume_tool_launch_ticket(text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_tool_launch_ticket(text, text, text, text, uuid, uuid, uuid, text) to service_role;
grant execute on function public.consume_tool_launch_ticket(text, text, text, text) to service_role;

commit;
