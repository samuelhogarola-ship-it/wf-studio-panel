begin;

alter table public.clients
add column if not exists portal_mode text not null default 'legacy';
alter table public.clients drop constraint if exists clients_portal_mode_check;
alter table public.clients add constraint clients_portal_mode_check
check (portal_mode in ('legacy', 'dynamic'));

create table if not exists public.client_projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  slug text not null check (btrim(slug) ~ '^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*$'),
  name text not null check (length(btrim(name)) > 0),
  domain text not null check (btrim(domain) ~ '^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$'),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  client_access_enabled boolean not null default false,
  hosting_label text,
  hosting_management_url text,
  analytics_registry_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists client_projects_slug_normalized_unique_idx
on public.client_projects (lower(btrim(slug)));
create unique index if not exists client_projects_domain_normalized_unique_idx
on public.client_projects (lower(btrim(domain)));
create index if not exists client_projects_client_status_idx
on public.client_projects (client_id, status);

create table if not exists public.project_capabilities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete cascade,
  capability_key text not null check (capability_key in ('products', 'domains', 'hosting', 'invoices', 'bonuses_reports', 'blogger', 'analytics')),
  state text not null default 'unavailable' check (state in ('unavailable', 'available', 'active')),
  launch_url text,
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and metadata - array['provisioning_confirmed', 'display_label', 'source'] = '{}'::jsonb
  ),
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, capability_key),
  constraint blogger_active_requires_validation check (
    capability_key <> 'blogger' or state <> 'active' or (launch_url is not null and validated_at is not null and launch_url like 'https://%')
  )
);

-- Snapshot IDs deliberately have no cascading foreign keys: deleting a project
-- or capability must not erase its history. Actor deletion also preserves history.
create table if not exists public.project_capability_audit (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  capability_id uuid not null,
  capability_key text not null,
  actor_id uuid,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  old_record jsonb,
  new_record jsonb,
  created_at timestamptz not null default now()
);
create index if not exists project_capability_audit_project_date_idx
on public.project_capability_audit (project_id, created_at desc);

drop trigger if exists set_client_projects_updated_at on public.client_projects;
create trigger set_client_projects_updated_at
before update on public.client_projects
for each row execute function public.set_updated_at();
drop trigger if exists set_project_capabilities_updated_at on public.project_capabilities;
create trigger set_project_capabilities_updated_at
before update on public.project_capabilities
for each row execute function public.set_updated_at();

-- Separate from the legacy helper: existing billing/resource policies stay intact.
create or replace function private.current_portal_client_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select c.id from public.clients c
  where auth.uid() is not null
    and c.project = 'wf-studio'
    and c.status = 'active'
    and lower(c.email) = private.current_client_email();
$$;

create or replace function private.can_read_client_project(p_project_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.client_projects p
    where p.id = p_project_id
      and p.client_id = private.current_portal_client_id()
      and p.status = 'active'
      and p.client_access_enabled
  );
$$;

create or replace function private.audit_project_capability()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.project_capability_audit
    (project_id, capability_id, capability_key, actor_id, operation, old_record, new_record)
  values (
    case when tg_op = 'DELETE' then old.project_id else new.project_id end,
    case when tg_op = 'DELETE' then old.id else new.id end,
    case when tg_op = 'DELETE' then old.capability_key else new.capability_key end,
    auth.uid(), tg_op,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return null;
end;
$$;
drop trigger if exists audit_project_capability on public.project_capabilities;
create trigger audit_project_capability
after insert or update or delete on public.project_capabilities
for each row execute function private.audit_project_capability();

create or replace function private.reject_capability_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Capability audit is append-only';
end;
$$;
drop trigger if exists project_capability_audit_append_only on public.project_capability_audit;
create trigger project_capability_audit_append_only
before update or delete or truncate on public.project_capability_audit
for each statement execute function private.reject_capability_audit_mutation();

revoke all on function private.current_portal_client_id() from public, anon;
revoke all on function private.can_read_client_project(uuid) from public, anon;
revoke all on function private.audit_project_capability() from public, anon, authenticated;
revoke all on function private.reject_capability_audit_mutation() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_portal_client_id() to authenticated;
grant execute on function private.can_read_client_project(uuid) to authenticated;

alter table public.client_projects enable row level security;
alter table public.project_capabilities enable row level security;
alter table public.project_capability_audit enable row level security;

drop policy if exists client_projects_admin_all on public.client_projects;
create policy client_projects_admin_all on public.client_projects
for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists client_projects_client_select on public.client_projects;
create policy client_projects_client_select on public.client_projects
for select to authenticated using (private.can_read_client_project(id));

drop policy if exists project_capabilities_admin_all on public.project_capabilities;
create policy project_capabilities_admin_all on public.project_capabilities
for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists project_capabilities_client_select on public.project_capabilities;
create policy project_capabilities_client_select on public.project_capabilities
for select to authenticated using (state = 'active' and private.can_read_client_project(project_id));

drop policy if exists project_capability_audit_admin_select on public.project_capability_audit;
create policy project_capability_audit_admin_select on public.project_capability_audit
for select to authenticated using (private.is_admin());

revoke all on public.client_projects, public.project_capabilities from public, anon, authenticated;
grant select, insert, update, delete on public.client_projects, public.project_capabilities to authenticated;
revoke all on public.project_capability_audit from public, anon, authenticated;
grant select on public.project_capability_audit to authenticated;

-- Registry seed: frozen from src/config/sites.json. Never overwrite assignments,
-- access flags, lifecycle, validation or capabilities configured by an administrator.
with seed(slug, name, domain) as (values
  ('webfuengirola', 'Web Fuengirola', 'webfuengirola.com'),
  ('vivirenfuengirola', 'Vivir en Fuengirola', 'vivirenfuengirola.com'),
  ('conocef', 'Conoce Fuengirola', 'conocefuengirola.com'),
  ('topfuengirola', 'Top Fuengirola', 'topfuengirola.com'),
  ('samuelcoachdealeman', 'Samuel Coach de Alemán', 'samuelcoachdealeman.com'),
  ('agama', 'aGama', 'agama.com.mx'),
  ('vikingfitness', 'Viking Fitness', 'vikingfitness.es'),
  ('personaltrainerfuengirola', 'Personal Trainer Fuengirola', 'personaltrainerfuengirola.com'),
  ('gimnasionuevoestilo', 'Gimnasio Nuevo Estilo', 'gimnasionuevoestilo.com'),
  ('bionatura', 'Bionatura', 'bionatura.es'),
  ('sportmassagefuengirola', 'Sport Massage Fuengirola', 'sportmassagefuengirola.com'),
  ('deutschkompakt', 'Deutschkompakt', 'deutschkompakt.com'),
  ('vokabellab', 'VokabelLab', 'vokabellab.com'),
  ('imkontext', 'imKontext', 'imkontext.vokabellab.com'),
  ('derdiedas', 'Der Die Das', 'derdiedas.vokabellab.com'),
  ('superentrenador', 'Superentrenador', 'superentrenador.com'),
  ('coachstudio', 'Coach Studio', 'coach.superentrenador.com'),
  ('todoplastico', 'TodoPlástico', 'todo-plastico.com')
)
insert into public.client_projects (slug, name, domain, analytics_registry_key)
select seed.slug, seed.name, seed.domain, seed.slug from seed
where not exists (
  select 1 from public.client_projects p
  where lower(btrim(p.slug)) = seed.slug or lower(btrim(p.domain)) = seed.domain
)
on conflict do nothing;

with seed(slug, domain) as (values
  ('webfuengirola', 'webfuengirola.com'),
  ('vivirenfuengirola', 'vivirenfuengirola.com'),
  ('conocef', 'conocefuengirola.com'),
  ('topfuengirola', 'topfuengirola.com'),
  ('samuelcoachdealeman', 'samuelcoachdealeman.com'),
  ('agama', 'agama.com.mx'),
  ('vikingfitness', 'vikingfitness.es'),
  ('personaltrainerfuengirola', 'personaltrainerfuengirola.com'),
  ('gimnasionuevoestilo', 'gimnasionuevoestilo.com'),
  ('bionatura', 'bionatura.es'),
  ('sportmassagefuengirola', 'sportmassagefuengirola.com'),
  ('deutschkompakt', 'deutschkompakt.com'),
  ('vokabellab', 'vokabellab.com'),
  ('imkontext', 'imkontext.vokabellab.com'),
  ('derdiedas', 'derdiedas.vokabellab.com'),
  ('superentrenador', 'superentrenador.com'),
  ('coachstudio', 'coach.superentrenador.com'),
  ('todoplastico', 'todo-plastico.com')
), capability_keys(capability_key) as (values
  ('products'), ('domains'), ('hosting'), ('invoices'), ('bonuses_reports'), ('blogger'), ('analytics')
)
insert into public.project_capabilities (project_id, capability_key, state)
select p.id, k.capability_key,
  case when k.capability_key = 'blogger' and seed.slug not in (
    'samuelcoachdealeman', 'webfuengirola', 'todoplastico', 'vikingfitness', 'sportmassagefuengirola', 'agama'
  ) then 'unavailable' else 'available' end
from seed join public.client_projects p
  on lower(btrim(p.slug)) = seed.slug or lower(btrim(p.domain)) = seed.domain
cross join capability_keys k
on conflict (project_id, capability_key) do nothing;

commit;
