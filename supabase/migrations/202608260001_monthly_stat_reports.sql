create table if not exists public.monthly_stat_reports (
  month_key text primary key check (month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  label text not null,
  markdown text not null,
  site_reports jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null,
  email_to text,
  email_sent_at timestamptz,
  email_message_id text,
  delivery_claim_token uuid,
  delivery_claimed_at timestamptz,
  last_delivery_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_monthly_stat_reports_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_monthly_stat_reports_updated_at on public.monthly_stat_reports;
create trigger set_monthly_stat_reports_updated_at
before update on public.monthly_stat_reports
for each row
execute function public.set_monthly_stat_reports_updated_at();

revoke all on function public.set_monthly_stat_reports_updated_at() from public, anon, authenticated;
grant execute on function public.set_monthly_stat_reports_updated_at() to service_role;

alter table public.monthly_stat_reports enable row level security;

drop policy if exists monthly_stat_reports_admin_select on public.monthly_stat_reports;
create policy monthly_stat_reports_admin_select on public.monthly_stat_reports
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

revoke all on table public.monthly_stat_reports from anon;
grant select on table public.monthly_stat_reports to authenticated;
grant all on table public.monthly_stat_reports to service_role;

create or replace function public.claim_monthly_stat_report_delivery(
  p_month_key text,
  p_claim_token uuid,
  p_email_to text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.monthly_stat_reports
  set delivery_claim_token = p_claim_token,
      delivery_claimed_at = timezone('utc', now()),
      email_to = p_email_to,
      last_delivery_error = null
  where month_key = p_month_key
    and email_sent_at is null
    and delivery_claim_token is null;
  return found;
end;
$$;

create or replace function public.complete_monthly_stat_report_delivery(
  p_month_key text,
  p_claim_token uuid,
  p_sent_at timestamptz,
  p_message_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.monthly_stat_reports
  set email_sent_at = p_sent_at,
      email_message_id = p_message_id,
      delivery_claim_token = null,
      delivery_claimed_at = null,
      last_delivery_error = null
  where month_key = p_month_key
    and email_sent_at is null
    and delivery_claim_token = p_claim_token;
  return found;
end;
$$;

create or replace function public.release_monthly_stat_report_delivery(
  p_month_key text,
  p_claim_token uuid,
  p_error text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.monthly_stat_reports
  set delivery_claim_token = null,
      delivery_claimed_at = null,
      last_delivery_error = left(p_error, 2000)
  where month_key = p_month_key
    and email_sent_at is null
    and delivery_claim_token = p_claim_token;
  return found;
end;
$$;

revoke all on function public.claim_monthly_stat_report_delivery(text, uuid, text) from public, anon, authenticated;
revoke all on function public.complete_monthly_stat_report_delivery(text, uuid, timestamptz, text) from public, anon, authenticated;
revoke all on function public.release_monthly_stat_report_delivery(text, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_monthly_stat_report_delivery(text, uuid, text) to service_role;
grant execute on function public.complete_monthly_stat_report_delivery(text, uuid, timestamptz, text) to service_role;
grant execute on function public.release_monthly_stat_report_delivery(text, uuid, text) to service_role;
