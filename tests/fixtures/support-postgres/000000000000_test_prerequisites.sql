-- Keep this test-only compatibility layer before copied production history.
-- The production migrations expect the roles and Auth/Storage objects that
-- Supabase normally installs; this fixture provides only the bounded surface
-- required by the support-session integration test.
set role supabase_admin;

do $$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_roles where rolname = role_name) then
      execute format('create role %I noinherit', role_name);
    end if;
  end loop;
end;
$$;

create schema if not exists auth;

create table auth.users (
  id uuid primary key,
  email text
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

grant usage on schema auth to authenticated;
grant select on auth.users to authenticated;
grant execute on function auth.uid() to public;
grant execute on function auth.jwt() to public;

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
grant usage on schema storage to authenticated;
grant select, insert on storage.buckets to postgres;
grant select on storage.objects to authenticated;
grant select, insert, delete on storage.objects to postgres;

reset role;
