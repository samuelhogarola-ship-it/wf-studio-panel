-- The Postgres image includes auth.users/auth.uid(), while Auth and Storage
-- services normally install these remaining objects in a full local stack.
-- Keep this test-only compatibility layer before copied production history.
set role supabase_admin;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

create schema if not exists storage;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key,
  bucket_id text not null references storage.buckets(id),
  name text not null
);

create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  path_parts text[];
begin
  select string_to_array(name, '/') into path_parts;
  return path_parts[1:array_length(path_parts, 1) - 1];
end;
$$;

alter table storage.objects enable row level security;

grant usage on schema storage to postgres;
grant select, insert on storage.buckets to postgres;
grant select on storage.objects to authenticated;
grant select, insert, delete on storage.objects to postgres;

reset role;
