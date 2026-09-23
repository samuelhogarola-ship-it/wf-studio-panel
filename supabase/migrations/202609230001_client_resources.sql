begin;
create table public.client_resources (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.clients(id) on delete cascade,
 kind text not null check(kind in ('report','update','photo')),
 title text not null check(length(title) between 1 and 200),
 body text not null default '',
 report_path text check(report_path is null or report_path like '/informes/%'),
 storage_path text unique,
 content_type text,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 check((kind = 'photo' and storage_path is not null and content_type in ('image/jpeg','image/png','image/webp')) or (kind <> 'photo' and storage_path is null))
);
create index client_resources_client_date_idx on public.client_resources(client_id,created_at desc);
alter table public.client_resources enable row level security;
create policy client_resources_admin_all on public.client_resources for all to authenticated using(private.is_admin()) with check(private.is_admin());
create policy client_resources_own_read on public.client_resources for select to authenticated using(exists(select 1 from public.clients c where c.id=client_id and c.project='wf-studio' and c.status='active' and lower(c.email)=lower(auth.jwt()->>'email')));
grant select,insert,update,delete on public.client_resources to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('client-resources','client-resources',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
-- No browser storage policies: authenticated server routes enforce client ownership.
commit;
