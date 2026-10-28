alter table public.invoices add column if not exists document_type text not null default 'invoice';
alter table public.invoices drop constraint if exists invoices_document_type_check;
alter table public.invoices add constraint invoices_document_type_check check (document_type in ('invoice', 'proposal'));
alter table public.invoices add column if not exists accounting_area text not null default 'general';
alter table public.invoices drop constraint if exists invoices_accounting_area_check;
alter table public.invoices add constraint invoices_accounting_area_check check (accounting_area in ('general', 'classes'));
alter table public.invoices add column if not exists transfer_instructions text;

create table if not exists public.proposal_number_sequences (
  year integer primary key,
  last_number integer not null check (last_number >= 0)
);

create or replace function public.next_proposal_number()
returns text language plpgsql security definer set search_path = public as $$
declare current_year integer := extract(year from current_date)::integer; next_sequence integer;
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  insert into public.proposal_number_sequences(year, last_number) values (current_year, 0) on conflict (year) do nothing;
  select last_number into next_sequence from public.proposal_number_sequences where year = current_year for update;
  next_sequence := next_sequence + 1;
  update public.proposal_number_sequences set last_number = next_sequence where year = current_year;
  return 'PROP-' || current_year::text || '-' || lpad(next_sequence::text, 4, '0');
end;
$$;

create or replace function public.create_billing_document_draft(
  p_client_id uuid, p_recipient_kind text, p_recipient_name text, p_recipient_email text, p_recipient_company text,
  p_concept text, p_amount numeric, p_payment_method text, p_document_type text, p_accounting_area text,
  p_transfer_instructions text default null, p_notes text default null, p_issued_at date default current_date
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
  if p_amount <= 0 or p_document_type not in ('invoice', 'proposal') or p_accounting_area not in ('general', 'classes') then raise exception 'Invalid billing document'; end if;
  generated_number := case when p_document_type = 'proposal' then public.next_proposal_number() else public.next_invoice_number() end;
  return query insert into public.invoices(client_id, number, concept, amount, payment_method, status, notes, issued_at, recipient_kind, recipient_name, recipient_email, recipient_company, document_type, accounting_area, transfer_instructions)
    values (p_client_id, generated_number, p_concept, p_amount, p_payment_method, 'draft', p_notes, p_issued_at, p_recipient_kind, p_recipient_name, lower(p_recipient_email), p_recipient_company, p_document_type, p_accounting_area, nullif(btrim(p_transfer_instructions), ''))
    returning public.invoices.id, public.invoices.number;
end;
$$;

create or replace function public.issue_billing_document(p_document_id uuid, p_payment_url text default null)
returns table(id uuid, number text, status text)
language plpgsql security definer set search_path = public, private as $$
declare document_row public.invoices%rowtype;
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  select * into document_row from public.invoices where public.invoices.id = p_document_id for update;
  if not found or document_row.status <> 'draft' then raise exception 'Document is not issuable'; end if;
  if p_payment_url is not null and p_payment_url !~ '^https://(buy|checkout)\.stripe\.com/' then raise exception 'Invalid payment link'; end if;
  update public.invoices set status = 'issued' where public.invoices.id = p_document_id;
  if p_payment_url is not null then insert into public.payment_links(invoice_id, url, created_by) values (p_document_id, p_payment_url, auth.uid()); end if;
  return query select public.invoices.id, public.invoices.number, public.invoices.status from public.invoices where public.invoices.id = p_document_id;
end;
$$;

create or replace function public.mark_invoice_paid(p_invoice_id uuid)
returns boolean language plpgsql security definer set search_path = public, private as $$
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  update public.invoices set status = 'paid', paid_at = current_date where id = p_invoice_id and status = 'issued' and document_type = 'invoice';
  return found;
end;
$$;

revoke all on function public.next_proposal_number() from public, anon;
revoke all on function public.create_billing_document_draft(uuid, text, text, text, text, text, numeric, text, text, text, text, text, date) from public, anon;
revoke all on function public.issue_billing_document(uuid, text) from public, anon;
grant execute on function public.next_proposal_number() to authenticated;
grant execute on function public.create_billing_document_draft(uuid, text, text, text, text, text, numeric, text, text, text, text, text, date) to authenticated;
grant execute on function public.issue_billing_document(uuid, text) to authenticated;
