alter table public.monthly_stat_reports
add column if not exists is_complete boolean not null default false;

create or replace function public.save_monthly_stat_report_snapshot(
  p_month_key text,
  p_label text,
  p_markdown text,
  p_site_reports jsonb,
  p_generated_at timestamptz,
  p_is_complete boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.monthly_stat_reports (
    month_key,
    label,
    markdown,
    site_reports,
    generated_at,
    is_complete
  )
  values (
    p_month_key,
    p_label,
    p_markdown,
    coalesce(p_site_reports, '[]'::jsonb),
    p_generated_at,
    p_is_complete
  )
  on conflict (month_key) do update
  set label = excluded.label,
      markdown = excluded.markdown,
      site_reports = excluded.site_reports,
      generated_at = excluded.generated_at,
      is_complete = excluded.is_complete
  where monthly_stat_reports.email_sent_at is null
    and monthly_stat_reports.delivery_claim_token is null;

  if found then
    return 'saved';
  end if;

  if exists (
    select 1 from public.monthly_stat_reports
    where month_key = p_month_key and email_sent_at is not null
  ) then
    return 'sent';
  end if;

  return 'claimed';
end;
$$;

create or replace function public.claim_monthly_stat_report_delivery_snapshot(
  p_month_key text,
  p_claim_token uuid,
  p_email_to text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_snapshot jsonb;
begin
  update public.monthly_stat_reports
  set delivery_claim_token = p_claim_token,
      delivery_claimed_at = timezone('utc', now()),
      email_to = p_email_to,
      last_delivery_error = null
  where month_key = p_month_key
    and is_complete = true
    and email_sent_at is null
    and (
      delivery_claim_token is null
      or delivery_claimed_at < timezone('utc', now()) - interval '15 minutes'
    )
  returning jsonb_build_object('label', label, 'markdown', markdown)
  into claimed_snapshot;

  return claimed_snapshot;
end;
$$;

revoke all on function public.save_monthly_stat_report_snapshot(text, text, text, jsonb, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public.claim_monthly_stat_report_delivery_snapshot(text, uuid, text) from public, anon, authenticated;
grant execute on function public.save_monthly_stat_report_snapshot(text, text, text, jsonb, timestamptz, boolean) to service_role;
grant execute on function public.claim_monthly_stat_report_delivery_snapshot(text, uuid, text) to service_role;
