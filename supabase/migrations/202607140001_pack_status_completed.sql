alter table public.packs
drop constraint if exists packs_status_check;

alter table public.packs
add constraint packs_status_check
check (status in ('active', 'inactive', 'completed'));
