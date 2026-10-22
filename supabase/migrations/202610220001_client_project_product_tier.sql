begin;

alter table public.client_projects
add column if not exists product_tier text;

alter table public.client_projects
drop constraint if exists client_projects_product_tier_check;

alter table public.client_projects
add constraint client_projects_product_tier_check
check (product_tier is null or product_tier in ('lite', 'express', 'pro'));

update public.client_projects
set product_tier = 'pro'
where (lower(btrim(slug)) = 'agama'
    and lower(btrim(domain)) = 'agama.com.mx'
  or lower(btrim(slug)) = 'todoplastico'
    and lower(btrim(domain)) = 'todo-plastico.com')
  and product_tier is distinct from 'pro';

commit;
