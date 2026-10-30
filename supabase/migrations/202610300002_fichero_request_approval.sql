begin;

create or replace function public.approve_directory_request(
  p_request_id uuid,
  p_profile_patch jsonb default '{}'::jsonb
)
returns table (outcome text, profile_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.platform_requests%rowtype;
  v_catalog_id uuid;
  v_profile_id uuid;
  v_profile jsonb;
  v_outcome text;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if p_profile_patch is null or jsonb_typeof(p_profile_patch) <> 'object' then
    raise exception 'Invalid profile patch' using errcode = '22023';
  end if;

  select *
  into v_request
  from public.platform_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Platform request not found' using errcode = 'P0002';
  end if;

  if v_request.request_type <> 'business'
    or v_request.profile_data ->> 'schema_version' <> 'fichero.v1'
    or v_request.profile_data ->> 'catalog' <> 'fuengirola' then
    raise exception 'Unsupported directory request' using errcode = '22023';
  end if;

  select id
  into v_profile_id
  from public.directory_profiles
  where source_request_id = p_request_id;

  if v_profile_id is not null then
    if v_request.status = 'rejected' then
      raise exception 'Platform request is already resolved' using errcode = 'P0001';
    end if;
    if v_request.status = 'pending' then
      update public.platform_requests
      set status = 'approved',
          reviewed_by = auth.uid(),
          reviewed_at = now(),
          rejection_reason = null
      where id = p_request_id;
    end if;
    return query select 'existing_profile'::text, v_profile_id;
    return;
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Platform request is already resolved' using errcode = 'P0001';
  end if;

  select id
  into v_catalog_id
  from public.directory_catalogs
  where key = 'fuengirola' and status = 'active';

  if v_catalog_id is null then
    raise exception 'Fuengirola directory catalog is unavailable';
  end if;

  v_profile := (v_request.profile_data -> 'profile') || p_profile_patch;

  insert into public.directory_profiles (
    catalog_id,
    source_request_id,
    canonical_slug,
    legal_name,
    display_name,
    cif,
    contact_email,
    phone,
    whatsapp,
    website,
    address,
    latitude,
    longitude,
    category_key,
    category_label,
    neighborhood_keys,
    short_description,
    long_description,
    seo_title,
    seo_description,
    services,
    schedule,
    photos,
    plan,
    review_status
  )
  values (
    v_catalog_id,
    p_request_id,
    v_profile ->> 'canonicalSlug',
    nullif(v_profile ->> 'legalName', ''),
    v_profile ->> 'displayName',
    nullif(v_profile ->> 'cif', ''),
    nullif(v_profile ->> 'contactEmail', ''),
    nullif(v_profile ->> 'phone', ''),
    nullif(v_profile ->> 'whatsapp', ''),
    nullif(v_profile ->> 'website', ''),
    nullif(v_profile ->> 'address', ''),
    nullif(v_profile ->> 'latitude', '')::double precision,
    nullif(v_profile ->> 'longitude', '')::double precision,
    v_profile ->> 'categoryKey',
    v_profile ->> 'categoryLabel',
    coalesce(array(select jsonb_array_elements_text(v_profile -> 'neighborhoodKeys')), '{}'),
    coalesce(v_profile ->> 'shortDescription', ''),
    coalesce(v_profile ->> 'longDescription', ''),
    nullif(v_profile ->> 'seoTitle', ''),
    nullif(v_profile ->> 'seoDescription', ''),
    coalesce(array(select jsonb_array_elements_text(v_profile -> 'services')), '{}'),
    coalesce(array(select jsonb_array_elements_text(v_profile -> 'schedule')), '{}'),
    coalesce(array(select jsonb_array_elements_text(v_profile -> 'photos')), '{}'),
    v_profile ->> 'plan',
    'draft'
  )
  returning id into v_profile_id;

  insert into public.directory_profile_channels (
    profile_id,
    channel_id,
    enabled,
    public_slug,
    editorial_placement
  )
  select
    v_profile_id,
    channel.id,
    true,
    v_profile ->> 'canonicalSlug',
    false
  from public.directory_channels channel
  where channel.catalog_id = v_catalog_id
    and channel.status = 'active';

  insert into public.directory_profile_reviews (
    profile_id,
    reviewer_id,
    decision,
    notes,
    snapshot
  )
  values (
    v_profile_id,
    auth.uid(),
    'approved',
    'Solicitud de alta aceptada; ficha pendiente de revisión editorial.',
    jsonb_build_object(
      'stage', 'intake',
      'source_request_id', p_request_id,
      'source_platform', v_request.platform,
      'profile', v_profile
    )
  );

  update public.platform_requests
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      rejection_reason = null
  where id = p_request_id;

  v_outcome := 'created_profile';
  return query select v_outcome, v_profile_id;
end;
$$;

revoke all on function public.approve_directory_request(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.approve_directory_request(uuid, jsonb) to authenticated;

commit;
