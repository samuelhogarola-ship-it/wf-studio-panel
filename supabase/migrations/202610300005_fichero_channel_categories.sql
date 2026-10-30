begin;

-- Each public directory has its own taxonomy; a canonical category cannot
-- safely be used as a foreign key in both destinations.
alter table public.directory_profile_channels
  add column category_slug text
  check (category_slug is null or category_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

commit;
