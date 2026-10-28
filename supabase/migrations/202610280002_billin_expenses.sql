create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  supplier text not null check (char_length(btrim(supplier)) between 1 and 200),
  concept text not null check (char_length(btrim(concept)) between 1 and 500),
  category text not null default 'other' check (category in ('software', 'services', 'taxes', 'travel', 'office', 'marketing', 'classes', 'other')),
  accounting_area text not null default 'general' check (accounting_area in ('general', 'classes')),
  amount numeric(12, 2) not null check (amount > 0),
  expense_date date not null default current_date,
  payment_method text not null default 'transfer' check (payment_method in ('transfer', 'card', 'cash', 'direct_debit', 'other')),
  status text not null default 'paid' check (status in ('paid', 'pending')),
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_expense_date_idx on public.expenses (expense_date desc);
create index expenses_client_id_idx on public.expenses (client_id);
create index expenses_accounting_area_idx on public.expenses (accounting_area, expense_date desc);

drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

alter table public.expenses enable row level security;

drop policy if exists expenses_admin_all on public.expenses;
create policy expenses_admin_all on public.expenses
for all
using (private.is_admin())
with check (private.is_admin());

grant select, insert, update, delete on public.expenses to authenticated;
revoke all on public.expenses from anon;
