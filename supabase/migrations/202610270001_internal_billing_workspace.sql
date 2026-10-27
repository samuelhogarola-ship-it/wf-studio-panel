begin;

create table public.billing_products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 200),
  description text,
  default_net_cents bigint check (default_net_cents is null or default_net_cents > 0),
  tax_mode text not null default 'taxable' check (tax_mode in ('taxable', 'exempt', 'non_taxable')),
  tax_rate_bps integer not null default 2100 check (tax_rate_bps between 0 and 10000),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index billing_products_name_unique on public.billing_products(lower(name));
create index billing_products_active_sort_idx on public.billing_products(active, sort_order, name);

insert into public.billing_products(name, default_net_cents, tax_mode, tax_rate_bps, sort_order)
select 'Web Lite', null, 'taxable', 2100, 10
where not exists (select 1 from public.billing_products where lower(name) = lower('Web Lite'));
insert into public.billing_products(name, default_net_cents, tax_mode, tax_rate_bps, sort_order)
select 'Web Express', null, 'taxable', 2100, 20
where not exists (select 1 from public.billing_products where lower(name) = lower('Web Express'));
insert into public.billing_products(name, default_net_cents, tax_mode, tax_rate_bps, sort_order)
select 'Web Profesional', 65000, 'taxable', 2100, 30
where not exists (select 1 from public.billing_products where lower(name) = lower('Web Profesional'));

create table public.billing_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('proposal', 'invoice', 'advance_invoice')),
  number text unique,
  status text not null default 'draft' check (status in ('draft', 'issued', 'paid', 'void')),
  client_id uuid references public.clients(id) on delete set null,
  recipient_name text not null,
  recipient_email text not null,
  recipient_company text,
  title text not null,
  notes text,
  document_date date not null default current_date,
  due_date date,
  source_proposal_id uuid references public.billing_documents(id) on delete set null,
  parent_invoice_id uuid references public.billing_documents(id) on delete set null,
  net_cents bigint not null default 0 check (net_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0 and total_cents = net_cents + tax_cents),
  issued_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (position('@' in recipient_email) > 1),
  check (due_date is null or due_date >= document_date)
);

create index billing_documents_client_date_idx on public.billing_documents(client_id, document_date desc);
create index billing_documents_status_date_idx on public.billing_documents(status, document_date desc);

create table public.billing_document_lines (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.billing_documents(id) on delete cascade,
  product_id uuid references public.billing_products(id) on delete set null,
  product_name text,
  description text not null check (char_length(trim(description)) between 1 and 1000),
  quantity numeric(12,3) not null check (quantity > 0),
  unit_net_cents bigint not null check (unit_net_cents >= 0),
  tax_mode text not null check (tax_mode in ('taxable', 'exempt', 'non_taxable')),
  tax_rate_bps integer not null check (tax_rate_bps between 0 and 10000),
  net_cents bigint not null check (net_cents >= 0),
  tax_cents bigint not null check (tax_cents >= 0),
  total_cents bigint not null check (total_cents = net_cents + tax_cents),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index billing_document_lines_document_idx on public.billing_document_lines(document_id, sort_order);

create table public.billing_number_sequences (
  series text not null check (series in ('PROP', 'WF')),
  year integer not null,
  last_number integer not null default 0 check (last_number >= 0),
  primary key (series, year)
);

create table public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.billing_documents(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  paid_on date not null default current_date,
  method text not null check (method in ('manual_link', 'transfer', 'cash', 'card', 'other')),
  note text,
  advance_invoice_id uuid references public.billing_documents(id) on delete set null,
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index billing_payments_document_date_idx on public.billing_payments(document_id, paid_on, created_at);

create table public.billing_payment_options (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null unique references public.billing_documents(id) on delete cascade,
  method text not null check (method in ('manual_link', 'transfer', 'cash')),
  url text,
  instructions text,
  active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((method = 'manual_link' and url is not null) or (method <> 'manual_link' and url is null))
);

create table public.billing_share_links (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.billing_documents(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '7 days'),
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  check (expires_at <= created_at + interval '7 days')
);

create index billing_share_links_document_idx on public.billing_share_links(document_id, expires_at desc);

create table public.ledger_income (
  id uuid primary key default gen_random_uuid(),
  category text not null check (char_length(trim(category)) between 1 and 120),
  description text not null check (char_length(trim(description)) between 1 and 1000),
  occurred_on date not null,
  source_mode text not null check (source_mode in ('individual', 'monthly_summary')),
  net_cents bigint not null check (net_cents > 0),
  tax_mode text not null check (tax_mode in ('taxable', 'exempt', 'non_taxable')),
  tax_rate_bps integer not null check (tax_rate_bps between 0 and 10000),
  tax_cents bigint not null check (tax_cents >= 0),
  total_cents bigint not null check (total_cents = net_cents + tax_cents),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  check ((tax_mode = 'taxable') or (tax_rate_bps = 0 and tax_cents = 0))
);

create index ledger_income_date_idx on public.ledger_income(occurred_on desc, source_mode, category);

drop trigger if exists set_billing_payment_options_updated_at on public.billing_payment_options;
create trigger set_billing_payment_options_updated_at before update on public.billing_payment_options
for each row execute function public.set_updated_at();

drop trigger if exists set_billing_products_updated_at on public.billing_products;
create trigger set_billing_products_updated_at before update on public.billing_products
for each row execute function public.set_updated_at();
drop trigger if exists set_billing_documents_updated_at on public.billing_documents;
create trigger set_billing_documents_updated_at before update on public.billing_documents
for each row execute function public.set_updated_at();

create or replace function private.guard_billing_document_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status <> 'draft' and (
    old.document_type is distinct from new.document_type or old.number is distinct from new.number
    or old.client_id is distinct from new.client_id or old.recipient_name is distinct from new.recipient_name
    or old.recipient_email is distinct from new.recipient_email or old.recipient_company is distinct from new.recipient_company
    or old.title is distinct from new.title or old.notes is distinct from new.notes
    or old.document_date is distinct from new.document_date or old.due_date is distinct from new.due_date
    or old.source_proposal_id is distinct from new.source_proposal_id or old.parent_invoice_id is distinct from new.parent_invoice_id
    or old.net_cents is distinct from new.net_cents or old.tax_cents is distinct from new.tax_cents or old.total_cents is distinct from new.total_cents
  ) then
    raise exception 'Issued billing documents are immutable';
  end if;
  return new;
end;
$$;

create trigger billing_documents_immutable after update on public.billing_documents
for each row execute function private.guard_billing_document_mutation();

create or replace function private.guard_billing_line_mutation()
returns trigger language plpgsql set search_path = public as $$
declare target_document_id uuid := coalesce(new.document_id, old.document_id);
begin
  if exists (select 1 from public.billing_documents where id = target_document_id and status <> 'draft') then
    raise exception 'Issued billing document lines are immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger billing_document_lines_immutable before insert or update or delete on public.billing_document_lines
for each row execute function private.guard_billing_line_mutation();

create or replace function public.save_billing_product(
  p_id uuid, p_name text, p_description text, p_default_net_cents bigint,
  p_tax_mode text, p_tax_rate_bps integer, p_active boolean default true, p_sort_order integer default 0
)
returns public.billing_products
language plpgsql security definer set search_path = public, private as $$
declare saved public.billing_products;
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  if char_length(trim(p_name)) not between 1 and 200 or (p_default_net_cents is not null and p_default_net_cents <= 0)
    or p_tax_mode not in ('taxable', 'exempt', 'non_taxable') or p_tax_rate_bps not between 0 and 10000 then
    raise exception 'Invalid billing product';
  end if;
  if p_id is null then
    insert into public.billing_products(name, description, default_net_cents, tax_mode, tax_rate_bps, active, sort_order)
    values (trim(p_name), nullif(trim(p_description), ''), p_default_net_cents, p_tax_mode, p_tax_rate_bps, p_active, p_sort_order)
    returning * into saved;
  else
    update public.billing_products set name = trim(p_name), description = nullif(trim(p_description), ''),
      default_net_cents = p_default_net_cents, tax_mode = p_tax_mode, tax_rate_bps = p_tax_rate_bps,
      active = p_active, sort_order = p_sort_order where id = p_id returning * into saved;
    if not found then raise exception 'Billing product not found'; end if;
  end if;
  return saved;
end;
$$;

create or replace function public.delete_billing_product(p_id uuid)
returns boolean language plpgsql security definer set search_path = public, private as $$
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  delete from public.billing_products where id = p_id;
  return found;
end;
$$;

create or replace function public.save_billing_document_draft(
  p_id uuid, p_document_type text, p_client_id uuid, p_recipient_name text, p_recipient_email text,
  p_recipient_company text, p_title text, p_notes text, p_document_date date, p_due_date date,
  p_source_proposal_id uuid, p_parent_invoice_id uuid, p_lines jsonb
)
returns public.billing_documents
language plpgsql security definer set search_path = public, private as $$
declare saved public.billing_documents; client_row public.clients%rowtype;
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  if p_document_type not in ('proposal', 'invoice', 'advance_invoice') or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Invalid billing document';
  end if;
  if p_client_id is not null then
    select * into client_row from public.clients where id = p_client_id and project = 'wf-studio' and status = 'active';
    if not found then raise exception 'Invalid client'; end if;
    p_recipient_name := client_row.name; p_recipient_email := client_row.email; p_recipient_company := client_row.company;
  end if;
  if char_length(trim(p_recipient_name)) = 0 or position('@' in p_recipient_email) <= 1 or char_length(trim(p_title)) = 0 then
    raise exception 'Invalid recipient or title';
  end if;

  if p_id is null then
    insert into public.billing_documents(document_type, client_id, recipient_name, recipient_email, recipient_company,
      title, notes, document_date, due_date, source_proposal_id, parent_invoice_id, created_by)
    values (p_document_type, p_client_id, trim(p_recipient_name), lower(trim(p_recipient_email)), nullif(trim(p_recipient_company), ''),
      trim(p_title), nullif(trim(p_notes), ''), coalesce(p_document_date, current_date), p_due_date, p_source_proposal_id, p_parent_invoice_id, auth.uid())
    returning * into saved;
  else
    update public.billing_documents set document_type = p_document_type, client_id = p_client_id,
      recipient_name = trim(p_recipient_name), recipient_email = lower(trim(p_recipient_email)), recipient_company = nullif(trim(p_recipient_company), ''),
      title = trim(p_title), notes = nullif(trim(p_notes), ''), document_date = coalesce(p_document_date, current_date), due_date = p_due_date,
      source_proposal_id = p_source_proposal_id, parent_invoice_id = p_parent_invoice_id
    where id = p_id and status = 'draft' returning * into saved;
    if not found then raise exception 'Draft not found'; end if;
    delete from public.billing_document_lines where document_id = saved.id;
  end if;

  insert into public.billing_document_lines(document_id, product_id, product_name, description, quantity, unit_net_cents,
    tax_mode, tax_rate_bps, net_cents, tax_cents, total_cents, sort_order)
  select saved.id, nullif(line->>'product_id', '')::uuid, nullif(trim(line->>'product_name'), ''), trim(line->>'description'),
    (line->>'quantity')::numeric, (line->>'unit_net_cents')::bigint, line->>'tax_mode', (line->>'tax_rate_bps')::integer,
    amounts.net_cents, amounts.tax_cents, amounts.net_cents + amounts.tax_cents, ordinality::integer
  from jsonb_array_elements(p_lines) with ordinality as item(line, ordinality)
  cross join lateral (
    select round((line->>'quantity')::numeric * (line->>'unit_net_cents')::bigint)::bigint as net_cents
  ) net
  cross join lateral (
    select net.net_cents, case when line->>'tax_mode' = 'taxable'
      then round(net.net_cents::numeric * (line->>'tax_rate_bps')::integer / 10000)::bigint else 0 end as tax_cents
  ) amounts
  where trim(coalesce(line->>'description', '')) <> ''
    and (line->>'quantity')::numeric > 0 and (line->>'unit_net_cents')::bigint >= 0
    and line->>'tax_mode' in ('taxable', 'exempt', 'non_taxable')
    and (line->>'tax_rate_bps')::integer between 0 and 10000;

  if (select count(*) from public.billing_document_lines where document_id = saved.id) <> jsonb_array_length(p_lines) then
    raise exception 'Invalid billing line';
  end if;

  update public.billing_documents d set net_cents = totals.net_cents, tax_cents = totals.tax_cents, total_cents = totals.total_cents
  from (select document_id, sum(net_cents)::bigint net_cents, sum(tax_cents)::bigint tax_cents, sum(total_cents)::bigint total_cents
    from public.billing_document_lines where document_id = saved.id group by document_id) totals
  where d.id = totals.document_id returning d.* into saved;
  return saved;
end;
$$;

create or replace function public.issue_billing_document(p_document_id uuid)
returns public.billing_documents
language plpgsql security definer set search_path = public, private as $$
declare saved public.billing_documents; sequence_series text; sequence_year integer; next_number integer; prefix text;
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  select * into saved from public.billing_documents where id = p_document_id for update;
  if not found or saved.status <> 'draft' or saved.total_cents <= 0 then raise exception 'Document is not issuable'; end if;
  sequence_series := case when saved.document_type = 'proposal' then 'PROP' else 'WF' end;
  prefix := case when sequence_series = 'PROP' then 'PROP-' else 'WF-' end;
  sequence_year := extract(year from saved.document_date)::integer;
  insert into public.billing_number_sequences(series, year, last_number) values (sequence_series, sequence_year, 0)
    on conflict (series, year) do nothing;
  select last_number into next_number from public.billing_number_sequences
    where series = sequence_series and year = sequence_year for update;
  next_number := next_number + 1;
  update public.billing_number_sequences set last_number = next_number where series = sequence_series and year = sequence_year;
  update public.billing_documents set number = prefix || sequence_year::text || '-' || lpad(next_number::text, 4, '0'),
    status = 'issued', issued_at = timezone('utc', now()) where id = p_document_id returning * into saved;
  return saved;
end;
$$;

create or replace function public.record_billing_payment(
  p_document_id uuid, p_amount_cents bigint, p_paid_on date, p_method text, p_note text default null
)
returns table(payment_id uuid, balance_cents bigint, advance_invoice_id uuid)
language plpgsql security definer set search_path = public, private as $$
declare document_row public.billing_documents%rowtype; paid_total bigint; saved_payment_id uuid;
  saved_advance_id uuid; single_tax_rate integer; advance_net bigint; advance_tax bigint;
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  if p_amount_cents <= 0 or p_method not in ('manual_link', 'transfer', 'cash', 'card', 'other') then raise exception 'Invalid payment'; end if;
  select * into document_row from public.billing_documents where id = p_document_id for update;
  if not found or document_row.status not in ('issued', 'paid') then raise exception 'Document cannot receive payments'; end if;
  select coalesce(sum(amount_cents), 0)::bigint into paid_total from public.billing_payments
    where document_id = p_document_id and reversed_at is null;
  if paid_total + p_amount_cents > document_row.total_cents then raise exception 'Payment exceeds document balance'; end if;
  insert into public.billing_payments(document_id, amount_cents, paid_on, method, note, created_by)
    values (p_document_id, p_amount_cents, coalesce(p_paid_on, current_date), p_method, nullif(trim(p_note), ''), auth.uid())
    returning id into saved_payment_id;

  if document_row.document_type = 'proposal' then
    select min(tax_rate_bps) into single_tax_rate from public.billing_document_lines
      where document_id = document_row.id and tax_mode = 'taxable'
      having count(*) = (select count(*) from public.billing_document_lines where document_id = document_row.id)
        and min(tax_rate_bps) = max(tax_rate_bps);
    if single_tax_rate is not null then
      advance_net := round(p_amount_cents::numeric * 10000 / (10000 + single_tax_rate))::bigint;
      advance_tax := p_amount_cents - advance_net;
      insert into public.billing_documents(document_type, status, client_id, recipient_name, recipient_email, recipient_company,
        title, notes, document_date, source_proposal_id, net_cents, tax_cents, total_cents, created_by)
      values ('advance_invoice', 'draft', document_row.client_id, document_row.recipient_name, document_row.recipient_email,
        document_row.recipient_company, 'Anticipo · ' || document_row.title, 'Generada desde el cobro de la propuesta ' || coalesce(document_row.number, ''),
        coalesce(p_paid_on, current_date), document_row.id, advance_net, advance_tax, p_amount_cents, auth.uid())
      returning id into saved_advance_id;
      insert into public.billing_document_lines(document_id, product_name, description, quantity, unit_net_cents,
        tax_mode, tax_rate_bps, net_cents, tax_cents, total_cents, sort_order)
      values (saved_advance_id, 'Anticipo', 'Anticipo de ' || document_row.title, 1, advance_net,
        'taxable', single_tax_rate, advance_net, advance_tax, p_amount_cents, 1);
      update public.billing_payments set advance_invoice_id = saved_advance_id where id = saved_payment_id;
    end if;
  end if;

  paid_total := paid_total + p_amount_cents;
  if paid_total = document_row.total_cents then update public.billing_documents set status = 'paid' where id = p_document_id; end if;
  return query select saved_payment_id, document_row.total_cents - paid_total, saved_advance_id;
end;
$$;

create or replace function public.reverse_billing_payment(p_payment_id uuid)
returns boolean language plpgsql security definer set search_path = public, private as $$
declare target_document_id uuid;
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  update public.billing_payments set reversed_at = timezone('utc', now()), reversed_by = auth.uid()
    where id = p_payment_id and reversed_at is null returning document_id into target_document_id;
  if not found then return false; end if;
  update public.billing_documents set status = 'issued' where id = target_document_id and status = 'paid';
  return true;
end;
$$;

create or replace function public.set_billing_payment_option(
  p_document_id uuid, p_method text, p_url text, p_instructions text, p_active boolean
)
returns boolean language plpgsql security definer set search_path = public, private as $$
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  if p_method not in ('manual_link', 'transfer', 'cash') then raise exception 'Invalid payment method'; end if;
  if p_method = 'manual_link' and (p_url is null or p_url !~ '^https://') then raise exception 'Invalid payment URL'; end if;
  if p_method <> 'manual_link' then p_url := null; end if;
  insert into public.billing_payment_options(document_id, method, url, instructions, active, created_by)
  values (p_document_id, p_method, p_url, nullif(trim(p_instructions), ''), p_active, auth.uid())
  on conflict (document_id) do update set method = excluded.method, url = excluded.url,
    instructions = excluded.instructions, active = excluded.active;
  return true;
end;
$$;

create or replace function public.create_billing_share(p_document_id uuid, p_token_hash text, p_expires_at timestamptz)
returns public.billing_share_links
language plpgsql security definer set search_path = public, private as $$
declare saved public.billing_share_links;
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' or p_expires_at <= now() or p_expires_at > now() + interval '7 days' then
    raise exception 'Invalid share';
  end if;
  if not exists (select 1 from public.billing_documents where id = p_document_id and status = 'issued') then
    raise exception 'Document is not available to share';
  end if;
  update public.billing_share_links set revoked_at = timezone('utc', now())
    where document_id = p_document_id and revoked_at is null;
  insert into public.billing_share_links(document_id, token_hash, expires_at, created_by)
    values (p_document_id, p_token_hash, p_expires_at, auth.uid()) returning * into saved;
  return saved;
end;
$$;

create or replace function public.revoke_billing_share(p_share_id uuid)
returns boolean language plpgsql security definer set search_path = public, private as $$
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  update public.billing_share_links set revoked_at = coalesce(revoked_at, timezone('utc', now())) where id = p_share_id;
  return found;
end;
$$;

create or replace function public.resolve_billing_share(p_token_hash text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'document', to_jsonb(d),
    'lines', coalesce((select jsonb_agg(to_jsonb(l) order by l.sort_order) from public.billing_document_lines l where l.document_id = d.id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(to_jsonb(p) order by p.paid_on, p.created_at) from public.billing_payments p where p.document_id = d.id and p.reversed_at is null), '[]'::jsonb),
    'paymentOption', to_jsonb(o)
  )
  from public.billing_share_links s
  join public.billing_documents d on d.id = s.document_id
  left join public.billing_payment_options o on o.document_id = d.id and o.active
  where s.token_hash = p_token_hash and s.revoked_at is null and s.expires_at > now() and d.status = 'issued'
  limit 1
$$;

create or replace function public.create_ledger_income(
  p_category text, p_description text, p_occurred_on date, p_source_mode text,
  p_net_cents bigint, p_tax_mode text, p_tax_rate_bps integer
)
returns public.ledger_income
language plpgsql security definer set search_path = public, private as $$
declare saved public.ledger_income; effective_rate integer; calculated_tax bigint;
begin
  if not private.is_admin() then raise exception using errcode = '42501', message = 'Not authorized'; end if;
  if p_source_mode not in ('individual', 'monthly_summary') or p_tax_mode not in ('taxable', 'exempt', 'non_taxable')
    or p_net_cents <= 0 or p_tax_rate_bps not between 0 and 10000 then raise exception 'Invalid income'; end if;
  effective_rate := case when p_tax_mode = 'taxable' then p_tax_rate_bps else 0 end;
  calculated_tax := round(p_net_cents * effective_rate / 10000.0);
  insert into public.ledger_income(category, description, occurred_on, source_mode, net_cents, tax_mode, tax_rate_bps, tax_cents, total_cents, created_by)
  values (trim(p_category), trim(p_description), p_occurred_on, p_source_mode, p_net_cents, p_tax_mode, effective_rate, calculated_tax, p_net_cents + calculated_tax, auth.uid())
  returning * into saved;
  return saved;
end;
$$;

alter table public.billing_products enable row level security;
alter table public.billing_documents enable row level security;
alter table public.billing_document_lines enable row level security;
alter table public.billing_number_sequences enable row level security;
alter table public.billing_payments enable row level security;
alter table public.billing_payment_options enable row level security;
alter table public.billing_share_links enable row level security;
alter table public.ledger_income enable row level security;

create policy billing_products_admin_all on public.billing_products for all to authenticated
using (private.is_admin()) with check (private.is_admin());
create policy billing_documents_admin_all on public.billing_documents for all to authenticated
using (private.is_admin()) with check (private.is_admin());
create policy billing_documents_client_read on public.billing_documents for select to authenticated
using (client_id = private.current_portal_client_id() and status = 'issued');
create policy billing_document_lines_admin_all on public.billing_document_lines for all to authenticated
using (private.is_admin()) with check (private.is_admin());
create policy billing_document_lines_client_read on public.billing_document_lines for select to authenticated
using (exists (select 1 from public.billing_documents d where d.id = document_id
  and d.client_id = private.current_portal_client_id() and d.status = 'issued'));
create policy billing_number_sequences_admin_read on public.billing_number_sequences for select to authenticated using (private.is_admin());
create policy billing_payments_admin_all on public.billing_payments for all to authenticated
using (private.is_admin()) with check (private.is_admin());
create policy billing_payments_client_read on public.billing_payments for select to authenticated
using (exists (select 1 from public.billing_documents d where d.id = document_id
  and d.client_id = private.current_portal_client_id() and d.status in ('issued', 'paid')));
create policy billing_payment_options_admin_all on public.billing_payment_options for all to authenticated
using (private.is_admin()) with check (private.is_admin());
create policy billing_payment_options_client_read on public.billing_payment_options for select to authenticated
using (active and exists (select 1 from public.billing_documents d where d.id = document_id
  and d.client_id = private.current_portal_client_id() and d.status in ('issued', 'paid')));
create policy billing_share_links_admin_all on public.billing_share_links for all to authenticated
using (private.is_admin()) with check (private.is_admin());
create policy ledger_income_admin_all on public.ledger_income for all to authenticated
using (private.is_admin()) with check (private.is_admin());

revoke all on function public.save_billing_product(uuid, text, text, bigint, text, integer, boolean, integer) from public, anon;
revoke all on function public.delete_billing_product(uuid) from public, anon;
revoke all on function public.save_billing_document_draft(uuid, text, uuid, text, text, text, text, text, date, date, uuid, uuid, jsonb) from public, anon;
revoke all on function public.issue_billing_document(uuid) from public, anon;
revoke all on function public.record_billing_payment(uuid, bigint, date, text, text) from public, anon;
revoke all on function public.reverse_billing_payment(uuid) from public, anon;
revoke all on function public.set_billing_payment_option(uuid, text, text, text, boolean) from public, anon;
revoke all on function public.create_billing_share(uuid, text, timestamptz) from public, anon;
revoke all on function public.revoke_billing_share(uuid) from public, anon;
revoke all on function public.resolve_billing_share(text) from public;
revoke all on function public.create_ledger_income(text, text, date, text, bigint, text, integer) from public, anon;
grant execute on function public.save_billing_product(uuid, text, text, bigint, text, integer, boolean, integer) to authenticated;
grant execute on function public.delete_billing_product(uuid) to authenticated;
grant execute on function public.save_billing_document_draft(uuid, text, uuid, text, text, text, text, text, date, date, uuid, uuid, jsonb) to authenticated;
grant execute on function public.issue_billing_document(uuid) to authenticated;
grant execute on function public.record_billing_payment(uuid, bigint, date, text, text) to authenticated;
grant execute on function public.reverse_billing_payment(uuid) to authenticated;
grant execute on function public.set_billing_payment_option(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.create_billing_share(uuid, text, timestamptz) to authenticated;
grant execute on function public.revoke_billing_share(uuid) to authenticated;
grant execute on function public.resolve_billing_share(text) to anon, authenticated;
grant execute on function public.create_ledger_income(text, text, date, text, bigint, text, integer) to authenticated;
grant select on public.billing_products, public.billing_documents, public.billing_document_lines,
  public.billing_payments, public.billing_payment_options, public.ledger_income to authenticated;

commit;
