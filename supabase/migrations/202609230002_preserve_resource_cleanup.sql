begin;
-- Client removal must not orphan private files by cascading their path records.
alter table public.client_resources
 drop constraint client_resources_client_id_fkey,
 add constraint client_resources_client_id_fkey foreign key (client_id)
 references public.clients(id) on delete restrict;
commit;
