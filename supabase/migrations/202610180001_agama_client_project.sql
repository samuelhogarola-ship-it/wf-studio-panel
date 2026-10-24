begin;

with inserted_project as (
  insert into public.client_projects (slug, name, domain, analytics_registry_key)
  select 'agama', 'Agama', 'agama.com.mx', 'agama'
  where not exists (
    select 1
    from public.client_projects p
    where lower(btrim(p.slug)) = 'agama'
       or lower(btrim(p.domain)) = 'agama.com.mx'
  )
  on conflict do nothing
  returning id
),
capability_keys(capability_key) as (values
  ('products'), ('domains'), ('hosting'), ('invoices'), ('bonuses_reports'), ('blogger'), ('analytics')
)
insert into public.project_capabilities (project_id, capability_key, state)
select p.id, k.capability_key, 'available'
from inserted_project p
cross join capability_keys k
on conflict (project_id, capability_key) do update
set state = 'available'
where public.project_capabilities.state = 'unavailable'
  and public.project_capabilities.launch_url is null
  and public.project_capabilities.metadata = '{}'::jsonb
  and public.project_capabilities.validated_at is null;

commit;
