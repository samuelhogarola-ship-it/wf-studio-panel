begin;

do $$
declare
  v_client_count integer;
  v_client_ids uuid[];
  v_client_id uuid;
  v_agama_count integer;
  v_agama_ids uuid[];
  v_agama_id uuid;
  v_agama_identity_valid boolean;
  v_todoplastico_count integer;
  v_todoplastico_ids uuid[];
  v_todoplastico_id uuid;
  v_todoplastico_identity_valid boolean;
  v_validated_at timestamptz := statement_timestamp();
begin
  select count(*)::integer, array_agg(c.id)
  into v_client_count, v_client_ids
  from public.clients c
  where lower(btrim(c.email)) = '547@agama.com.mx'
    and c.project = 'wf-studio'
    and c.status = 'active';

  if v_client_count <> 1 then
    raise exception 'Expected exactly one active wf-studio client for normalized email 547@agama.com.mx; found %', v_client_count;
  end if;
  v_client_id := v_client_ids[1];

  select
    count(*)::integer,
    array_agg(p.id),
    bool_and(
      lower(btrim(p.slug)) = 'agama'
      and lower(btrim(p.domain)) = 'agama.com.mx'
    )
  into v_agama_count, v_agama_ids, v_agama_identity_valid
  from public.client_projects p
  where lower(btrim(p.slug)) = 'agama'
     or lower(btrim(p.domain)) = 'agama.com.mx';

  if v_agama_count <> 1 or not coalesce(v_agama_identity_valid, false) then
    raise exception 'Expected exactly one project with normalized identity agama / agama.com.mx; found % candidate(s)', v_agama_count;
  end if;
  v_agama_id := v_agama_ids[1];

  select
    count(*)::integer,
    array_agg(p.id),
    bool_and(
      lower(btrim(p.slug)) = 'todoplastico'
      and lower(btrim(p.domain)) = 'todo-plastico.com'
    )
  into v_todoplastico_count, v_todoplastico_ids, v_todoplastico_identity_valid
  from public.client_projects p
  where lower(btrim(p.slug)) = 'todoplastico'
     or lower(btrim(p.domain)) = 'todo-plastico.com';

  if v_todoplastico_count <> 1 or not coalesce(v_todoplastico_identity_valid, false) then
    raise exception 'Expected exactly one project with normalized identity todoplastico / todo-plastico.com; found % candidate(s)', v_todoplastico_count;
  end if;
  v_todoplastico_id := v_todoplastico_ids[1];

  update public.client_projects
  set client_id = v_client_id,
      status = 'active',
      client_access_enabled = true,
      product_tier = 'pro'
  where id = any (array[v_agama_id, v_todoplastico_id])
    and (client_id, status, client_access_enabled, product_tier)
      is distinct from (v_client_id, 'active', true, 'pro');

  insert into public.project_capabilities
    (project_id, capability_key, state, launch_url, metadata, validated_at)
  values
    (v_agama_id, 'analytics', 'active', null, '{}'::jsonb, v_validated_at),
    (v_todoplastico_id, 'analytics', 'active', null, '{}'::jsonb, v_validated_at)
  on conflict (project_id, capability_key) do update
  set state = 'active',
      validated_at = coalesce(public.project_capabilities.validated_at, excluded.validated_at)
  where public.project_capabilities.state is distinct from 'active'
     or public.project_capabilities.validated_at is null;

  insert into public.project_capabilities
    (project_id, capability_key, state, launch_url, metadata, validated_at)
  values (
    v_agama_id,
    'blogger',
    'active',
    'https://admin.webfuengirola.com/paneladmin/blogger/agama',
    '{"provisioning_confirmed": true}'::jsonb,
    v_validated_at
  )
  on conflict (project_id, capability_key) do update
  set state = 'active',
      launch_url = excluded.launch_url,
      metadata = public.project_capabilities.metadata || excluded.metadata,
      validated_at = coalesce(public.project_capabilities.validated_at, excluded.validated_at)
  where public.project_capabilities.state is distinct from 'active'
     or public.project_capabilities.launch_url is distinct from excluded.launch_url
     or not public.project_capabilities.metadata @> excluded.metadata
     or public.project_capabilities.validated_at is null;

  -- TodoPlástico Blogger adapter handoff / deployment checklist:
  -- keep Studio at available with no destination or validation until the application adapter
  -- in agama-marketplace passes protected edit, publish, unpublish and public-read end-to-end tests.
  insert into public.project_capabilities
    (project_id, capability_key, state, launch_url, metadata, validated_at)
  values (
    v_todoplastico_id,
    'blogger',
    'available',
    null,
    '{}'::jsonb,
    null
  )
  on conflict (project_id, capability_key) do update
  set state = 'available',
      launch_url = null,
      metadata = public.project_capabilities.metadata - 'provisioning_confirmed',
      validated_at = null
  where public.project_capabilities.state is distinct from 'available'
     or public.project_capabilities.launch_url is not null
     or public.project_capabilities.metadata ? 'provisioning_confirmed'
     or public.project_capabilities.validated_at is not null;
end;
$$;

commit;
