alter table public.expenses
  drop constraint if exists expenses_supplier_check;

alter table public.expenses
  alter column supplier drop not null;

update public.expenses
set supplier = null
where supplier = 'Sin proveedor';

alter table public.expenses
  add constraint expenses_supplier_check
  check (supplier is null or char_length(btrim(supplier)) between 1 and 200);

comment on column public.expenses.supplier is
  'Optional supplier or payee name for the accounting entry.';
