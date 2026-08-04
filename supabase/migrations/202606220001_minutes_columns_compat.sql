alter table public.packs
add column if not exists minutes_total integer;

update public.packs
set minutes_total = coalesce(minutes_total, round(hours_total * 60)::integer)
where minutes_total is null;

alter table public.packs
alter column minutes_total set default 0;

update public.packs
set minutes_total = 0
where minutes_total is null;

alter table public.packs
alter column minutes_total set not null;

alter table public.packs
drop constraint if exists packs_minutes_total_positive;

alter table public.packs
add constraint packs_minutes_total_positive
check (minutes_total >= 0);

alter table public.activities
add column if not exists minutes_used integer;

update public.activities
set minutes_used = coalesce(minutes_used, round(hours_used * 60)::integer)
where minutes_used is null;

update public.activities
set minutes_used = 0
where minutes_used is null;

alter table public.activities
alter column minutes_used set not null;

alter table public.activities
drop constraint if exists activities_minutes_used_positive;

alter table public.activities
add constraint activities_minutes_used_positive
check (minutes_used >= 0);
