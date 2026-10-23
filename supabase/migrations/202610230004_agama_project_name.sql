begin;

update public.client_projects
set name = 'Agama'
where lower(btrim(slug)) = 'agama'
  and lower(btrim(domain)) = 'agama.com.mx'
  and name is distinct from 'Agama';

commit;
