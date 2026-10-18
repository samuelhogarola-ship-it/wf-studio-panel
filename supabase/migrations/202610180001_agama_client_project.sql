begin;

insert into public.client_projects (slug, name, domain, analytics_registry_key)
select 'agama', 'aGama', 'agama.com.mx', 'agama'
where not exists (
  select 1
  from public.client_projects p
  where lower(btrim(p.slug)) = 'agama'
     or lower(btrim(p.domain)) = 'agama.com.mx'
)
on conflict do nothing;

with capability_keys(capability_key) as (values
  ('products'), ('domains'), ('hosting'), ('invoices'), ('bonuses_reports'), ('blogger'), ('analytics')
)
insert into public.project_capabilities (project_id, capability_key, state)
select p.id, k.capability_key, 'available'
from public.client_projects p
cross join capability_keys k
where lower(btrim(p.slug)) = 'agama'
   or lower(btrim(p.domain)) = 'agama.com.mx'
on conflict (project_id, capability_key) do nothing;

commit;
