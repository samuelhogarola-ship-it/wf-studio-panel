begin;

alter table public.clients
drop constraint if exists clients_project_check;

alter table public.clients
add constraint clients_project_check
check (project in (
  'wf-studio',
  'vivir-fuengirola',
  'vivir-fuengirola-negocios',
  'conoce-fuengirola'
));

commit;
