create table if not exists public.billing_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  account_type text not null check (account_type in ('bank', 'stripe', 'cash', 'other')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_accounts enable row level security;
drop policy if exists billing_accounts_admin_all on public.billing_accounts;
create policy billing_accounts_admin_all on public.billing_accounts
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

alter table public.invoices add column if not exists billing_account_id uuid references public.billing_accounts(id) on delete restrict;
alter table public.expenses add column if not exists billing_account_id uuid references public.billing_accounts(id) on delete restrict;
create index if not exists invoices_billing_account_idx on public.invoices (billing_account_id, issued_at desc);
create index if not exists expenses_billing_account_idx on public.expenses (billing_account_id, expense_date desc);

create or replace function public.create_billing_document_draft(
  p_client_id uuid, p_recipient_kind text, p_recipient_name text, p_recipient_email text, p_recipient_company text,
  p_concept text, p_amount numeric, p_payment_method text, p_document_type text, p_accounting_area text,
  p_billing_account_id uuid, p_transfer_instructions text default null, p_notes text default null, p_issued_at date default current_date
)
returns table(id uuid, number text)
language plpgsql security definer set search_path = public, private as $$
declare generated_number text;
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  if p_client_id is not null and not exists (select 1 from public.clients c where c.id = p_client_id and c.project = 'wf-studio' and c.status = 'active') then raise exception 'Invalid client'; end if;
  if p_billing_account_id is not null and not exists (select 1 from public.billing_accounts a where a.id = p_billing_account_id and a.status = 'active') then raise exception 'Invalid billing account'; end if;
  if p_recipient_kind not in ('registered', 'external') or p_recipient_name is null or position('@' in p_recipient_email) <= 1 then raise exception 'Invalid recipient'; end if;
  if p_recipient_kind = 'registered' and p_client_id is null then raise exception 'Registered recipient requires client'; end if;
  if p_recipient_kind = 'external' and p_client_id is not null then raise exception 'External recipient cannot have client'; end if;
  if p_amount <= 0 or p_document_type not in ('invoice', 'proposal') or p_accounting_area not in ('general', 'classes') then raise exception 'Invalid billing document'; end if;
  generated_number := case when p_document_type = 'proposal' then public.next_proposal_number() else public.next_invoice_number() end;
  return query insert into public.invoices(client_id, number, concept, amount, payment_method, status, notes, issued_at, recipient_kind, recipient_name, recipient_email, recipient_company, document_type, accounting_area, billing_account_id, transfer_instructions)
    values (p_client_id, generated_number, p_concept, p_amount, p_payment_method, 'draft', p_notes, p_issued_at, p_recipient_kind, p_recipient_name, lower(p_recipient_email), p_recipient_company, p_document_type, p_accounting_area, p_billing_account_id, nullif(btrim(p_transfer_instructions), ''))
    returning public.invoices.id, public.invoices.number;
end;
$$;

revoke all on function public.create_billing_document_draft(uuid, text, text, text, text, text, numeric, text, text, text, uuid, text, text, date) from public, anon;
grant execute on function public.create_billing_document_draft(uuid, text, text, text, text, text, numeric, text, text, text, uuid, text, text, date) to authenticated;
revoke execute on function public.create_billing_document_draft(uuid, text, text, text, text, text, numeric, text, text, text, text, text, date) from authenticated;

notify pgrst, 'reload schema';
