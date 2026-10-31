begin;

create or replace function public.review_directory_profile(
  p_profile_id uuid,
  p_decision text,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.directory_profiles%rowtype;
  v_status text;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid review decision' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and nullif(btrim(p_note), '') is null then
    raise exception 'A rejection note is required' using errcode = '22023';
  end if;

  select * into v_profile
  from public.directory_profiles
  where id = p_profile_id
  for update;
  if not found then raise exception 'Directory profile not found' using errcode = 'P0002'; end if;
  if v_profile.review_status = 'archived' then
    raise exception 'Archived profiles cannot be reviewed' using errcode = 'P0001';
  end if;

  v_status := p_decision;
  update public.directory_profiles
  set review_status = v_status,
      approved_at = case when v_status <> 'approved' then null
                         when v_profile.review_status = 'approved' then v_profile.approved_at
                         else now() end,
      approved_by = case when v_status = 'approved' then auth.uid() else null end
  where id = p_profile_id;

  insert into public.directory_profile_reviews (profile_id, reviewer_id, decision, notes, snapshot)
  values (
    p_profile_id,
    auth.uid(),
    p_decision,
    nullif(btrim(p_note), ''),
    to_jsonb(v_profile) || jsonb_build_object('review_status', v_status)
  );
  return v_status;
end;
$$;

revoke all on function public.review_directory_profile(uuid, text, text) from public, anon, authenticated;
grant execute on function public.review_directory_profile(uuid, text, text) to authenticated;

commit;
