create or replace function private.reject_billing_document_type_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.document_type is distinct from old.document_type then
    raise exception 'Billing document type cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_document_type_immutable on public.invoices;
create trigger invoices_document_type_immutable
before update of document_type on public.invoices
for each row execute function private.reject_billing_document_type_change();
