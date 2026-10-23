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

grant usage on schema storage to postgres;
grant select, insert on storage.buckets to postgres;

reset role;
