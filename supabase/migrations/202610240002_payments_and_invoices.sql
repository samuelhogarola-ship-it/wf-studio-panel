begin;

alter table public.invoices alter column client_id drop not null;
alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices add constraint invoices_status_check check (status in ('draft', 'issued', 'paid', 'void'));
alter table public.invoices add column if not exists recipient_kind text;
alter table public.invoices add column if not exists recipient_name text;
alter table public.invoices add column if not exists recipient_email text;
alter table public.invoices add column if not exists recipient_company text;

update public.invoices i
set recipient_kind = 'registered', recipient_name = coalesce(c.name, 'Cliente'), recipient_email = coalesce(c.email, ''), recipient_company = c.company
from public.clients c
where c.id = i.client_id and (i.recipient_name is null or i.recipient_email is null or i.recipient_kind is null);

alter table public.invoices alter column recipient_kind set default 'registered';
alter table public.invoices alter column recipient_kind set not null;
alter table public.invoices alter column recipient_name set not null;
alter table public.invoices alter column recipient_email set not null;
alter table public.invoices add constraint invoices_recipient_kind_check check (recipient_kind in ('registered', 'external'));
alter table public.invoices add constraint invoices_recipient_email_check check (position('@' in recipient_email) > 1);

create table if not exists public.invoice_number_sequences (year integer primary key, last_number integer not null check (last_number >= 0));

create table if not exists public.invoice_audit (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  old_record jsonb,
  new_record jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  recipient_name text not null,
  recipient_email text not null,
  recipient_company text,
  concept text not null,
  amount numeric not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (position('@' in recipient_email) > 1)
);

create table if not exists public.payment_links (
  id uuid primary key default gen_random_uuid(),
  payment_request_id uuid references public.payment_requests(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete cascade,
  provider text not null default 'stripe' check (provider = 'stripe'),
  url text not null check (url ~ '^https://(buy|checkout)\.stripe\.com/'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  check (num_nonnulls(payment_request_id, invoice_id) = 1)
);

create unique index if not exists payment_links_invoice_unique on public.payment_links(invoice_id) where invoice_id is not null;
create unique index if not exists payment_links_request_unique on public.payment_links(payment_request_id) where payment_request_id is not null;
create index if not exists payment_requests_client_created_idx on public.payment_requests(client_id, created_at desc);
create index if not exists invoice_audit_invoice_created_idx on public.invoice_audit(invoice_id, created_at desc);

create or replace function public.next_invoice_number()
returns text language plpgsql security definer set search_path = public as $$
declare current_year integer := extract(year from current_date)::integer; next_sequence integer;
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  insert into public.invoice_number_sequences(year, last_number) values (current_year, 0) on conflict (year) do nothing;
  select last_number into next_sequence from public.invoice_number_sequences where year = current_year for update;
  next_sequence := next_sequence + 1;
  update public.invoice_number_sequences set last_number = next_sequence where year = current_year;
  return 'WF-' || current_year::text || '-' || lpad(next_sequence::text, 4, '0');
end;
$$;

create or replace function private.audit_invoice_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.invoice_audit(invoice_id, actor_id, operation, old_record, new_record)
  values (case when tg_op = 'DELETE' then old.id else new.id end, auth.uid(), tg_op,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists invoices_append_audit on public.invoices;
create trigger invoices_append_audit after insert or update or delete on public.invoices for each row execute function private.audit_invoice_change();

create or replace function private.prevent_invoice_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status is distinct from new.status and not (
    (old.status = 'draft' and new.status = 'issued')
    or (old.status = 'issued' and new.status in ('paid', 'void'))
  ) then
    raise exception 'Invalid invoice status transition';
  end if;
  if old.client_id is distinct from new.client_id or old.recipient_kind is distinct from new.recipient_kind or old.recipient_name is distinct from new.recipient_name or old.recipient_email is distinct from new.recipient_email or old.recipient_company is distinct from new.recipient_company or old.amount is distinct from new.amount or old.concept is distinct from new.concept then
    raise exception 'Issued invoice fields are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_immutable_snapshot on public.invoices;
create trigger invoices_immutable_snapshot before update on public.invoices for each row execute function private.prevent_invoice_mutation();

create or replace function private.reject_invoice_audit_mutation()
returns trigger language plpgsql set search_path = public as $$
begin raise exception 'Invoice audit is append-only'; end;
$$;
drop trigger if exists invoice_audit_append_only on public.invoice_audit;
create trigger invoice_audit_append_only before update or delete or truncate on public.invoice_audit for each statement execute function private.reject_invoice_audit_mutation();

create or replace function private.reject_invoice_delete()
returns trigger language plpgsql set search_path = public as $$
begin raise exception 'Invoices cannot be deleted'; end;
$$;
drop trigger if exists invoices_no_delete on public.invoices;
create trigger invoices_no_delete before delete on public.invoices for each row execute function private.reject_invoice_delete();

create or replace function public.create_invoice_draft(
  p_client_id uuid, p_recipient_kind text, p_recipient_name text, p_recipient_email text, p_recipient_company text,
  p_concept text, p_amount numeric, p_payment_method text, p_notes text default null, p_issued_at date default current_date
)
returns table(id uuid, number text)
language plpgsql security definer set search_path = public, private as $$
declare generated_number text;
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  if p_client_id is not null and not exists (select 1 from public.clients c where c.id = p_client_id and c.project = 'wf-studio' and c.status = 'active') then raise exception 'Invalid client'; end if;
  if p_recipient_kind not in ('registered', 'external') or p_recipient_name is null or position('@' in p_recipient_email) <= 1 then raise exception 'Invalid recipient'; end if;
  if p_recipient_kind = 'registered' and p_client_id is null then raise exception 'Registered recipient requires client'; end if;
  if p_recipient_kind = 'external' and p_client_id is not null then raise exception 'External recipient cannot have client'; end if;
  if p_amount <= 0 then raise exception 'Invalid amount'; end if;
  generated_number := public.next_invoice_number();
  return query insert into public.invoices(client_id, number, concept, amount, payment_method, status, notes, issued_at, recipient_kind, recipient_name, recipient_email, recipient_company)
    values (p_client_id, generated_number, p_concept, p_amount, p_payment_method, 'draft', p_notes, p_issued_at, p_recipient_kind, p_recipient_name, lower(p_recipient_email), p_recipient_company)
    returning public.invoices.id, public.invoices.number;
end;
$$;

create or replace function public.issue_invoice_with_payment_link(p_invoice_id uuid, p_payment_url text default null)
returns table(id uuid, number text, status text)
language plpgsql security definer set search_path = public, private as $$
declare invoice_row public.invoices%rowtype;
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  select * into invoice_row from public.invoices where public.invoices.id = p_invoice_id for update;
  if not found or invoice_row.status <> 'draft' then raise exception 'Invoice is not issuable'; end if;
  if p_payment_url is not null and p_payment_url !~ '^https://(buy|checkout)\.stripe\.com/' then raise exception 'Invalid payment link'; end if;
  update public.invoices set status = 'issued' where public.invoices.id = p_invoice_id;
  if p_payment_url is not null then insert into public.payment_links(invoice_id, url, created_by) values (p_invoice_id, p_payment_url, auth.uid()); end if;
  return query select public.invoices.id, public.invoices.number, public.invoices.status from public.invoices where public.invoices.id = p_invoice_id;
end;
$$;

create or replace function public.mark_invoice_paid(p_invoice_id uuid)
returns boolean language plpgsql security definer set search_path = public, private as $$
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  update public.invoices set status = 'paid', paid_at = current_date where id = p_invoice_id and status = 'issued';
  return found;
end;
$$;

alter table public.invoice_audit enable row level security;
alter table public.payment_requests enable row level security;
alter table public.payment_links enable row level security;

drop policy if exists invoices_client_select_own on public.invoices;
create policy invoices_client_select_own on public.invoices for select to authenticated using (client_id = private.current_portal_client_id() and status in ('issued', 'paid'));
drop policy if exists invoice_audit_admin_all on public.invoice_audit;
create policy invoice_audit_admin_all on public.invoice_audit for select to authenticated using (private.is_admin());
drop policy if exists payment_requests_admin_all on public.payment_requests;
create policy payment_requests_admin_all on public.payment_requests for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists payment_requests_client_select_own on public.payment_requests;
create policy payment_requests_client_select_own on public.payment_requests for select to authenticated using (client_id = private.current_portal_client_id());
drop policy if exists payment_links_admin_all on public.payment_links;
create policy payment_links_admin_all on public.payment_links for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists payment_links_client_select_own on public.payment_links;
create policy payment_links_client_select_own on public.payment_links for select to authenticated using (
  exists (select 1 from public.invoices i where i.id = invoice_id and i.client_id = private.current_portal_client_id() and i.status in ('issued', 'paid'))
  or exists (select 1 from public.payment_requests r where r.id = payment_request_id and r.client_id = private.current_portal_client_id())
);

revoke all on function public.next_invoice_number() from public, anon;
revoke all on function public.create_invoice_draft(uuid, text, text, text, text, text, numeric, text, text, date) from public, anon;
revoke all on function public.issue_invoice_with_payment_link(uuid, text) from public, anon;
revoke all on function public.mark_invoice_paid(uuid) from public, anon;
grant execute on function public.next_invoice_number() to authenticated;
grant execute on function public.create_invoice_draft(uuid, text, text, text, text, text, numeric, text, text, date) to authenticated;
grant execute on function public.issue_invoice_with_payment_link(uuid, text) to authenticated;
grant execute on function public.mark_invoice_paid(uuid) to authenticated;
grant select on public.payment_requests, public.payment_links to authenticated;

commit;
