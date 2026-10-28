create or replace function private.reject_proposal_payment_link()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.invoice_id is not null and exists (
    select 1 from public.invoices where invoices.id = new.invoice_id and invoices.document_type = 'proposal'
  ) then
    raise exception 'Proposal cannot have a payment link';
  end if;
  return new;
end;
$$;

drop trigger if exists payment_links_reject_proposals on public.payment_links;
create trigger payment_links_reject_proposals
before insert or update of invoice_id on public.payment_links
for each row execute function private.reject_proposal_payment_link();

create or replace function public.issue_invoice_with_payment_link(p_invoice_id uuid, p_payment_url text default null)
returns table(id uuid, number text, status text)
language plpgsql security definer set search_path = public, private as $$
declare invoice_row public.invoices%rowtype;
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  select * into invoice_row from public.invoices where public.invoices.id = p_invoice_id for update;
  if not found or invoice_row.status <> 'draft' then raise exception 'Invoice is not issuable'; end if;
  if invoice_row.document_type <> 'invoice' then raise exception 'Only invoices can have a payment link'; end if;
  if p_payment_url is not null and p_payment_url !~ '^https://(buy|checkout)\.stripe\.com/' then raise exception 'Invalid payment link'; end if;
  update public.invoices set status = 'issued' where public.invoices.id = p_invoice_id;
  if p_payment_url is not null then insert into public.payment_links(invoice_id, url, created_by) values (p_invoice_id, p_payment_url, auth.uid()); end if;
  return query select public.invoices.id, public.invoices.number, public.invoices.status from public.invoices where public.invoices.id = p_invoice_id;
end;
$$;
