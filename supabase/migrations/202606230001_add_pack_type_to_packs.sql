alter table public.packs
add column if not exists pack_type text not null default 'hours';

alter table public.packs
drop constraint if exists packs_pack_type_check;

alter table public.packs
add constraint packs_pack_type_check
check (pack_type in ('hours', 'tasks'));

create or replace view public.pack_summary
with (security_invoker = true)
as
select
  p.id as pack_id,
  p.client_id,
  p.name as pack_name,
  p.pack_type,
  p.minutes_total,
  coalesce(sum(a.minutes_used), 0)::integer as used_minutes,
  (p.minutes_total - coalesce(sum(a.minutes_used), 0))::integer as remaining_minutes
from public.packs p
left join public.activities a on a.pack_id = p.id
group by p.id, p.client_id, p.name, p.pack_type, p.minutes_total;
