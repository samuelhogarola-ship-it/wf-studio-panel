delete from public.payment_links links
using public.invoices documents
where links.invoice_id = documents.id
  and documents.document_type = 'proposal';

create or replace function public.issue_billing_document(p_document_id uuid, p_payment_url text default null)
returns table(id uuid, number text, status text)
language plpgsql security definer set search_path = public, private as $$
declare document_row public.invoices%rowtype;
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  select * into document_row from public.invoices where public.invoices.id = p_document_id for update;
  if not found or document_row.status <> 'draft' then raise exception 'Document is not issuable'; end if;
  if document_row.document_type = 'proposal' and p_payment_url is not null then raise exception 'Proposal cannot have a payment link'; end if;
  if p_payment_url is not null and p_payment_url !~ '^https://(buy|checkout)\.stripe\.com/' then raise exception 'Invalid payment link'; end if;
  update public.invoices set status = 'issued' where public.invoices.id = p_document_id;
  if p_payment_url is not null then insert into public.payment_links(invoice_id, url, created_by) values (p_document_id, p_payment_url, auth.uid()); end if;
  return query select public.invoices.id, public.invoices.number, public.invoices.status from public.invoices where public.invoices.id = p_document_id;
end;
$$;

create or replace function public.get_expense_ledger_summary(p_area text default null)
returns table(total numeric, entry_count bigint)
language plpgsql security definer set search_path = public, private as $$
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  if p_area is not null and p_area not in ('general', 'classes') then raise exception 'Invalid accounting area'; end if;
  return query
    select coalesce(sum(expenses.amount), 0)::numeric, count(*)
    from public.expenses
    where p_area is null or expenses.accounting_area = p_area;
end;
$$;

revoke all on function public.get_expense_ledger_summary(text) from public, anon;
grant execute on function public.get_expense_ledger_summary(text) to authenticated;
