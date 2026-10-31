begin;

-- Existing table invariant: unique (profile_id, channel_id, source_version).
create or replace function public.prepare_directory_publication(
  p_profile_id uuid,
  p_expected_updated_at timestamptz,
  p_projections jsonb
)
returns table (
  event_id uuid,
  channel_id uuid,
  channel_key text,
  public_slug text,
  source_version bigint,
  payload_hash text,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.directory_profiles%rowtype;
  v_enabled_count integer;
  v_valid_count integer;
  v_source_version bigint;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_projections) <> 'array' then
    raise exception 'Publication projections must be an array' using errcode = '22023';
  end if;

  select * into v_profile
  from public.directory_profiles
  where id = p_profile_id
  for update;
  if not found then raise exception 'Directory profile not found' using errcode = 'P0002'; end if;
  if v_profile.review_status <> 'approved' then
    raise exception 'Directory profile must be approved' using errcode = 'P0001';
  end if;
  if v_profile.updated_at <> p_expected_updated_at then
    raise exception 'Directory profile changed during publication' using errcode = '40001';
  end if;

  if v_profile.content_version > 0 and exists (
    select 1 from public.directory_publication_events existing_event
    where existing_event.profile_id = p_profile_id
      and existing_event.source_version = v_profile.content_version
      and existing_event.created_at >= v_profile.approved_at
  ) then
    return query
    select event.id, event.channel_id, channel.key, link.public_slug,
           event.source_version, event.payload_hash, event.status
    from public.directory_publication_events event
    join public.directory_channels channel on channel.id = event.channel_id
    join public.directory_profile_channels link
      on link.profile_id = event.profile_id and link.channel_id = event.channel_id
    where event.profile_id = p_profile_id and event.source_version = v_profile.content_version
    order by channel.key;
    return;
  end if;

  select count(*) into v_enabled_count
  from public.directory_profile_channels link
  join public.directory_channels channel on channel.id = link.channel_id
  where link.profile_id = p_profile_id and (link.enabled or (link.last_publication_status is not null and link.last_publication_status <> 'withdrawn')) and channel.status = 'active';

  select count(*) into v_valid_count
  from (
    select distinct (item ->> 'channelId')::uuid as channel_id
    from jsonb_array_elements(p_projections) item
    where item ->> 'channelKey' in ('vivir-fuengirola', 'conoce-fuengirola')
      and item ->> 'publicSlug' ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      and item ->> 'payloadHash' ~ '^[0-9a-f]{64}$'
  ) projection
  join public.directory_profile_channels link
    on link.profile_id = p_profile_id and link.channel_id = projection.channel_id and (link.enabled or (link.last_publication_status is not null and link.last_publication_status <> 'withdrawn'))
  join public.directory_channels channel
    on channel.id = link.channel_id and channel.status = 'active';

  if v_enabled_count = 0
    or v_valid_count <> v_enabled_count
    or jsonb_array_length(p_projections) <> v_enabled_count then
    raise exception 'Publication projections do not match enabled channels' using errcode = '22023';
  end if;

  update public.directory_profiles
  set content_version = content_version + 1,
      approved_at = coalesce(approved_at, now()),
      approved_by = coalesce(approved_by, auth.uid())
  where id = p_profile_id
  returning content_version into v_source_version;

  insert into public.directory_publication_events (
    profile_id, channel_id, source_version, idempotency_key, status, payload_hash
  )
  select p_profile_id,
         (item ->> 'channelId')::uuid,
         v_source_version,
         p_profile_id::text || ':' || (item ->> 'channelKey') || ':' || v_source_version::text,
         'pending',
         item ->> 'payloadHash'
  from jsonb_array_elements(p_projections) item;

  update public.directory_profile_channels link
  set last_publication_status = 'pending',
      last_publication_error = null
  where link.profile_id = p_profile_id and (link.enabled or (link.last_publication_status is not null and link.last_publication_status <> 'withdrawn'));

  return query
  select event.id, event.channel_id, channel.key, link.public_slug,
         event.source_version, event.payload_hash, event.status
  from public.directory_publication_events event
  join public.directory_channels channel on channel.id = event.channel_id
  join public.directory_profile_channels link
    on link.profile_id = event.profile_id and link.channel_id = event.channel_id
  where event.profile_id = p_profile_id and event.source_version = v_source_version
  order by channel.key;
end;
$$;

create or replace function public.begin_directory_publication_event(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_status text;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  select status into v_status from public.directory_publication_events where id = p_event_id for update;
  if not found then raise exception 'Publication event not found' using errcode = 'P0002'; end if;
  if v_status in ('published', 'withdrawn', 'publishing') then return false; end if;
  update public.directory_publication_events
  set status = 'publishing', attempt_count = attempt_count + 1, started_at = now(),
      completed_at = null, error_code = null, error_message = null
  where id = p_event_id;
  return true;
end;
$$;

create or replace function public.finish_directory_publication_event(
  p_event_id uuid,
  p_status text,
  p_remote_record_id text default null,
  p_error_code text default null,
  p_error_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_event public.directory_publication_events%rowtype;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_status not in ('published', 'withdrawn', 'failed') then
    raise exception 'Invalid publication result' using errcode = '22023';
  end if;
  select * into v_event from public.directory_publication_events where id = p_event_id for update;
  if not found then raise exception 'Publication event not found' using errcode = 'P0002'; end if;
  if v_event.status in ('published', 'withdrawn') and v_event.status = p_status then return false; end if;
  if v_event.status <> 'publishing' then
    raise exception 'Publication event is not in progress' using errcode = 'P0001';
  end if;

  update public.directory_publication_events
  set status = p_status,
      remote_record_id = case when p_status in ('published', 'withdrawn') then nullif(btrim(p_remote_record_id), '') else null end,
      error_code = case when p_status = 'failed' then left(coalesce(nullif(btrim(p_error_code), ''), 'destination_unavailable'), 80) else null end,
      error_message = case when p_status = 'failed' then left(coalesce(nullif(btrim(p_error_message), ''), 'No se pudo completar la publicación.'), 240) else null end,
      completed_at = now()
  where id = p_event_id;

  update public.directory_profile_channels
  set last_published_version = case when p_status in ('published', 'withdrawn') then v_event.source_version else last_published_version end,
      last_publication_status = p_status,
      last_publication_error = case when p_status = 'failed' then left(coalesce(nullif(btrim(p_error_message), ''), 'No se pudo completar la publicación.'), 240) else null end,
      last_published_at = case when p_status in ('published', 'withdrawn') then now() else last_published_at end
  where profile_id = v_event.profile_id and channel_id = v_event.channel_id;

  if p_status = 'published' then
    update public.directory_profiles set published_at = coalesce(published_at, now()) where id = v_event.profile_id;
  end if;
  return true;
end;
$$;

revoke all on function public.prepare_directory_publication(uuid, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.begin_directory_publication_event(uuid) from public, anon, authenticated;
revoke all on function public.finish_directory_publication_event(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.prepare_directory_publication(uuid, timestamptz, jsonb) to authenticated;
grant execute on function public.begin_directory_publication_event(uuid) to authenticated;
grant execute on function public.finish_directory_publication_event(uuid, text, text, text, text) to authenticated;

commit;
