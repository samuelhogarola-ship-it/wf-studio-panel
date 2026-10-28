alter table public.expenses
  add column if not exists expense_nature text not null default 'one_off';

alter table public.expenses
  drop constraint if exists expenses_expense_nature_check;

alter table public.expenses
  add constraint expenses_expense_nature_check
  check (expense_nature in ('fixed', 'recurring', 'one_off'));

create index if not exists expenses_expense_nature_idx
  on public.expenses (expense_nature, expense_date desc);

comment on column public.expenses.expense_nature is
  'Bill-in classification only: fixed, recurring variable, or one-off. It does not generate future entries.';
