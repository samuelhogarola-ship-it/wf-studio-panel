begin;

create schema if not exists extensions;
create extension if not exists citext with schema extensions;

create table public.directory_catalogs (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.directory_channels (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null references public.directory_catalogs(id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (catalog_id, key),
  unique (id, catalog_id)
);

create table public.directory_profiles (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null references public.directory_catalogs(id) on delete restrict,
  source_request_id uuid unique references public.platform_requests(id) on delete set null,
  owner_user_id uuid references auth.users(id) on delete set null,
  canonical_slug text not null check (canonical_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  legal_name text,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 160),
  cif extensions.citext,
  contact_email extensions.citext,
  phone text,
  whatsapp text,
  website text,
  address text,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  category_key text not null,
  category_label text not null,
  neighborhood_keys text[] not null default '{}',
  short_description text not null default '',
  long_description text not null default '',
  seo_title text,
  seo_description text,
  services text[] not null default '{}',
  schedule text[] not null default '{}',
  photos text[] not null default '{}',
  plan text not null default 'gratis' check (plan in ('gratis', 'pro', 'premium')),
  review_status text not null default 'draft' check (review_status in ('draft', 'pending_review', 'approved', 'rejected', 'archived')),
  content_version bigint not null default 0 check (content_version >= 0),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (catalog_id, canonical_slug),
  check (contact_email is null or contact_email::text = lower(btrim(contact_email::text))),
  check (cardinality(neighborhood_keys) <= 20),
  check (cardinality(services) <= 50),
  check (cardinality(schedule) <= 21),
  check (cardinality(photos) <= 20)
);

create table public.directory_profile_channels (
  profile_id uuid not null references public.directory_profiles(id) on delete cascade,
  channel_id uuid not null references public.directory_channels(id) on delete cascade,
  enabled boolean not null default true,
  public_slug text not null check (public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  editorial_placement boolean not null default false,
  last_published_version bigint check (last_published_version is null or last_published_version > 0),
  last_publication_status text check (last_publication_status is null or last_publication_status in ('pending', 'publishing', 'published', 'failed', 'withdrawn')),
  last_publication_error text,
  last_published_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (profile_id, channel_id),
  unique (channel_id, public_slug),
  check (not editorial_placement or enabled)
);

create table public.directory_profile_reviews (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.directory_profiles(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected', 'returned_to_draft')),
  notes text,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now()
);

create table public.directory_publication_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.directory_profiles(id) on delete cascade,
  channel_id uuid not null references public.directory_channels(id) on delete cascade,
  source_version bigint not null check (source_version > 0),
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'publishing', 'published', 'failed', 'withdrawn')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  remote_record_id text,
  error_code text,
  error_message text check (error_message is null or char_length(error_message) <= 1000),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, channel_id, source_version)
);

create table public.directory_slug_redirects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.directory_profiles(id) on delete cascade,
  channel_id uuid not null references public.directory_channels(id) on delete cascade,
  old_slug text not null check (old_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  new_slug text not null check (new_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  http_status smallint not null default 308 check (http_status = 308),
  created_at timestamptz not null default now(),
  unique (channel_id, old_slug),
  check (old_slug <> new_slug)
);

create index directory_profiles_review_queue_idx
on public.directory_profiles (review_status, updated_at desc);

create index directory_profiles_catalog_plan_status_idx
on public.directory_profiles (catalog_id, plan, review_status);

create index directory_profiles_normalized_cif_idx
on public.directory_profiles ((upper(regexp_replace(coalesce(cif::text, ''), '[^A-Za-z0-9]', '', 'g'))))
where cif is not null;

create index directory_profiles_contact_email_idx
on public.directory_profiles ((lower(contact_email::text)))
where contact_email is not null;

create index directory_publication_events_retry_idx
on public.directory_publication_events (status, updated_at)
where status in ('pending', 'failed');

create index directory_profile_reviews_profile_created_idx
on public.directory_profile_reviews (profile_id, created_at desc);

create trigger set_directory_catalogs_updated_at
before update on public.directory_catalogs
for each row execute function public.set_updated_at();

create trigger set_directory_channels_updated_at
before update on public.directory_channels
for each row execute function public.set_updated_at();

create trigger set_directory_profiles_updated_at
before update on public.directory_profiles
for each row execute function public.set_updated_at();

create trigger set_directory_profile_channels_updated_at
before update on public.directory_profile_channels
for each row execute function public.set_updated_at();

create trigger set_directory_publication_events_updated_at
before update on public.directory_publication_events
for each row execute function public.set_updated_at();

insert into public.directory_catalogs (key, name, status)
values ('fuengirola', 'fuengirola', 'active')
on conflict (key) do update
set name = excluded.name,
    status = excluded.status;

with catalog as (
  select id from public.directory_catalogs where key = 'fuengirola'
)
insert into public.directory_channels (catalog_id, key, name, status)
select catalog.id, channel.key, channel.name, channel.status
from catalog
cross join (
  values
    ('vivir-fuengirola', 'vivir en fuengirola', 'active'),
    ('conoce-fuengirola', 'conoce fuengirola', 'active')
) as channel(key, name, status)
on conflict (catalog_id, key) do update
set name = excluded.name,
    status = excluded.status;

alter table public.directory_catalogs enable row level security;
alter table public.directory_channels enable row level security;
alter table public.directory_profiles enable row level security;
alter table public.directory_profile_channels enable row level security;
alter table public.directory_profile_reviews enable row level security;
alter table public.directory_publication_events enable row level security;
alter table public.directory_slug_redirects enable row level security;

revoke all on table public.directory_catalogs from public, anon, authenticated;
revoke all on table public.directory_channels from public, anon, authenticated;
revoke all on table public.directory_profiles from public, anon, authenticated;
revoke all on table public.directory_profile_channels from public, anon, authenticated;
revoke all on table public.directory_profile_reviews from public, anon, authenticated;
revoke all on table public.directory_publication_events from public, anon, authenticated;
revoke all on table public.directory_slug_redirects from public, anon, authenticated;

grant select, insert, update, delete on table public.directory_catalogs to authenticated;
grant select, insert, update, delete on table public.directory_channels to authenticated;
grant select, insert, update, delete on table public.directory_profiles to authenticated;
grant select, insert, update, delete on table public.directory_profile_channels to authenticated;
grant select, insert, update, delete on table public.directory_profile_reviews to authenticated;
grant select, insert, update, delete on table public.directory_publication_events to authenticated;
grant select, insert, update, delete on table public.directory_slug_redirects to authenticated;

create policy directory_catalogs_admin_all on public.directory_catalogs for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy directory_channels_admin_all on public.directory_channels for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy directory_profiles_admin_all on public.directory_profiles for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy directory_profile_channels_admin_all on public.directory_profile_channels for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy directory_profile_reviews_admin_all on public.directory_profile_reviews for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy directory_publication_events_admin_all on public.directory_publication_events for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy directory_slug_redirects_admin_all on public.directory_slug_redirects for all to authenticated using (private.is_admin()) with check (private.is_admin());

commit;
