begin;

alter table public.billing_documents
  add column if not exists legacy_invoice_id uuid references public.invoices(id) on delete restrict;

alter table public.billing_documents
  add column if not exists tax_breakdown_review_required boolean not null default false;

create unique index if not exists billing_documents_legacy_invoice_unique
  on public.billing_documents(legacy_invoice_id)
  where legacy_invoice_id is not null;

create temp table if not exists legacy_invoice_imported_documents (
  document_id uuid primary key,
  legacy_invoice_id uuid unique
) on commit drop;
truncate table legacy_invoice_imported_documents;

-- A matching number can only be linked when its immutable fiscal identity is
-- already compatible. Anything else is a conflict that needs human review.
do $$
declare
  conflict_row record;
begin
  for conflict_row in
    select
      i.id as legacy_invoice_id,
      i.number,
      i.client_id as expected_client_id,
      i.recipient_name as expected_recipient_name,
      i.recipient_email as expected_recipient_email,
      i.recipient_company as expected_recipient_company,
      i.concept as expected_title,
      d.id as document_id,
      d.document_type,
      d.status,
      d.client_id,
      d.recipient_name,
      d.recipient_email,
      d.recipient_company,
      d.title,
      d.legacy_invoice_id as linked_legacy_invoice_id,
      d.net_cents,
      d.tax_cents,
      d.total_cents,
      case i.number
        when 'WF-2026-001' then 20000::bigint
        when 'WF-2026-002' then 65000::bigint
        else round(i.amount * 100)::bigint
      end as expected_net_cents,
      case i.number
        when 'WF-2026-001' then 4200::bigint
        when 'WF-2026-002' then 13650::bigint
        else 0::bigint
      end as expected_tax_cents,
      case i.number
        when 'WF-2026-001' then 24200::bigint
        when 'WF-2026-002' then 78650::bigint
        else round(i.amount * 100)::bigint
      end as expected_total_cents,
      case
        when i.number in ('WF-2026-001', 'WF-2026-002') then 'paid'
        when i.status in ('draft', 'issued', 'paid', 'void') then i.status
        else 'issued'
      end as expected_status
    from public.invoices i
    join public.billing_documents d on d.number = i.number
    where d.legacy_invoice_id is distinct from i.id
  loop
    if conflict_row.linked_legacy_invoice_id is not null
      or conflict_row.document_type <> 'invoice'
      or conflict_row.status <> conflict_row.expected_status
      or conflict_row.net_cents <> conflict_row.expected_net_cents
      or conflict_row.tax_cents <> conflict_row.expected_tax_cents
      or conflict_row.total_cents <> conflict_row.expected_total_cents
      or (case conflict_row.number
        when 'WF-2026-001' then coalesce(conflict_row.recipient_company, '') not like '%J29227907%'
        when 'WF-2026-002' then coalesce(conflict_row.recipient_company, '') not like '%B93154425%'
        else (conflict_row.client_id is distinct from conflict_row.expected_client_id
          or conflict_row.recipient_name is distinct from conflict_row.expected_recipient_name
          or conflict_row.recipient_email is distinct from conflict_row.expected_recipient_email
          or conflict_row.recipient_company is distinct from conflict_row.expected_recipient_company
          or conflict_row.title is distinct from conflict_row.expected_title)
      end) then
      raise exception 'Billing document number conflict for %', conflict_row.number;
    end if;

    update public.billing_documents
      set legacy_invoice_id = conflict_row.legacy_invoice_id
      where id = conflict_row.document_id and legacy_invoice_id is null;
  end loop;
end;
$$;

with inserted as (
  insert into public.billing_documents (
    document_type, number, status, client_id, recipient_name, recipient_email,
    recipient_company, title, notes, document_date, net_cents, tax_cents,
    total_cents, issued_at, created_at, updated_at, legacy_invoice_id,
    tax_breakdown_review_required
  )
  select
    'invoice',
    i.number,
    'draft',
    i.client_id,
    i.recipient_name,
    i.recipient_email,
    case i.number
      when 'WF-2026-001' then E'Gimnasio Nuevo Estilo, S.C.\nCIF: J29227907'
      when 'WF-2026-002' then E'SuVilla SL\nCIF: B93154425\nAvenida Acapulco, 8-10, local 1-B\n29640 Fuengirola'
      else i.recipient_company
    end,
    case i.number
      when 'WF-2026-001' then 'Página web'
      when 'WF-2026-002' then 'Propuesta web profesional'
      else i.concept
    end,
    case when i.number in ('WF-2026-001', 'WF-2026-002') then null
      else 'Importación histórica: desglose fiscal pendiente de revisar; el tipo técnico de la línea no implica exención ni no sujeción.' end,
    i.issued_at,
    case i.number when 'WF-2026-001' then 20000 when 'WF-2026-002' then 65000 else round(i.amount * 100)::bigint end,
    case i.number when 'WF-2026-001' then 4200 when 'WF-2026-002' then 13650 else 0 end,
    case i.number when 'WF-2026-001' then 24200 when 'WF-2026-002' then 78650 else round(i.amount * 100)::bigint end,
    null,
    i.created_at,
    i.updated_at,
    i.id,
    case when i.number in ('WF-2026-001', 'WF-2026-002') then false else true end
  from public.invoices i
  where not exists (
    select 1 from public.billing_documents d where d.legacy_invoice_id = i.id or d.number = i.number
  )
  returning id, legacy_invoice_id
)
insert into legacy_invoice_imported_documents(document_id, legacy_invoice_id)
select id, legacy_invoice_id from inserted;

insert into public.billing_document_lines (
  document_id, product_name, description, quantity, unit_net_cents,
  tax_mode, tax_rate_bps, net_cents, tax_cents, total_cents, sort_order
)
select
  d.id,
  case when i.number = 'WF-2026-002' then 'Web Profesional'
       when i.number = 'WF-2026-001' then 'Página web'
       else 'Importación histórica' end,
  case when i.number = 'WF-2026-002' then 'Desarrollo de propuesta web profesional para SuVilla SL.'
       when i.number = 'WF-2026-001' then 'Desarrollo de página web para Gimnasio Nuevo Estilo.'
       else i.concept || ' — desglose fiscal pendiente de revisar; clasificación técnica, no fiscal.' end,
  1,
  d.net_cents,
  case when i.number in ('WF-2026-001', 'WF-2026-002') then 'taxable' else 'non_taxable' end,
  case when i.number in ('WF-2026-001', 'WF-2026-002') then 2100 else 0 end,
  d.net_cents,
  d.tax_cents,
  d.total_cents,
  1
from legacy_invoice_imported_documents imported
join public.billing_documents d on d.id = imported.document_id
join public.invoices i on i.id = imported.legacy_invoice_id
where not exists (
  select 1 from public.billing_document_lines line where line.document_id = d.id
);

update public.billing_documents d
set
  status = case
    when i.number in ('WF-2026-001', 'WF-2026-002') then 'paid'
    when i.status in ('draft', 'issued', 'paid', 'void') then i.status
    else 'issued'
  end,
  issued_at = case
    when i.status = 'draft' and i.number not in ('WF-2026-001', 'WF-2026-002') then null
    else i.issued_at::timestamptz
  end
from legacy_invoice_imported_documents imported
join public.invoices i on i.id = imported.legacy_invoice_id
where d.id = imported.document_id;

-- Bionatura had verified fiscal evidence locally but no final legacy invoice.
do $$
declare
  existing_document public.billing_documents%rowtype;
  matched_client public.clients%rowtype;
  new_document_id uuid;
begin
  select * into existing_document from public.billing_documents where number = 'WF-2026-003';
  if found then
    if existing_document.document_type <> 'invoice'
      or existing_document.status <> 'paid'
      or existing_document.net_cents <> 20000
      or existing_document.tax_cents <> 4200
      or existing_document.total_cents <> 24200
      or coalesce(existing_document.recipient_company, '') not like '%B92371301%' then
      raise exception 'Billing document number conflict for WF-2026-003';
    end if;
    return;
  end if;

  select * into matched_client
  from public.clients
  where project = 'wf-studio'
    and status = 'active'
    and (lower(name) like '%bionatura%' or lower(coalesce(company, '')) like '%bionatura%')
  order by created_at
  limit 1;

  insert into public.billing_documents (
    document_type, number, status, client_id, recipient_name, recipient_email,
    recipient_company, title, notes, document_date, net_cents, tax_cents,
    total_cents, tax_breakdown_review_required
  ) values (
    'invoice', 'WF-2026-003', 'draft', matched_client.id,
    case when matched_client.id is null then 'Miguel' else matched_client.name end,
    case when matched_client.id is null then 'info@webfuengirola.com' else matched_client.email end,
    E'Bionatura del Sur SL\nCIF: B92371301\nCalle Tórtolas 11\n29640 Fuengirola',
    'Página web Lite', 'Factura final creada desde la documentación local verificada.',
    date '2026-10-27', 20000, 4200, 24200, false
  ) returning id into new_document_id;

  insert into public.billing_document_lines (
    document_id, product_name, description, quantity, unit_net_cents,
    tax_mode, tax_rate_bps, net_cents, tax_cents, total_cents, sort_order
  ) values (
    new_document_id, 'Web Lite', 'Desarrollo de página web Lite para Bionatura del Sur SL.',
    1, 20000, 'taxable', 2100, 20000, 4200, 24200, 1
  );

  update public.billing_documents
  set status = 'paid', issued_at = timezone('utc', now())
  where id = new_document_id;
end;
$$;

-- A paid legacy invoice has either no active payment yet, or the exact full
-- payment already recorded. Partial/mismatched histories stop the migration.
do $$
declare
  payment_conflict record;
begin
  for payment_conflict in
    select d.number, d.total_cents,
      coalesce(sum(p.amount_cents) filter (where p.reversed_at is null), 0)::bigint as paid_cents
    from public.billing_documents d
    left join public.billing_payments p on p.document_id = d.id
    where d.status = 'paid'
      and (d.legacy_invoice_id is not null or d.number = 'WF-2026-003')
    group by d.id
    having coalesce(sum(p.amount_cents) filter (where p.reversed_at is null), 0)::bigint not in (0, d.total_cents)
  loop
    raise exception 'Imported payment conflict for %', payment_conflict.number;
  end loop;
end;
$$;

insert into public.billing_payments(document_id, amount_cents, paid_on, method, note)
select
  d.id,
  d.total_cents,
  coalesce(i.paid_at, i.issued_at),
  case i.payment_method when 'cash' then 'cash' when 'card' then 'card' when 'transfer' then 'transfer' else 'other' end,
  'Importación de factura histórica ' || d.number
from public.billing_documents d
join public.invoices i on i.id = d.legacy_invoice_id
where d.status = 'paid'
  and not exists (
    select 1 from public.billing_payments p where p.document_id = d.id and p.reversed_at is null
  );

insert into public.billing_payments(document_id, amount_cents, paid_on, method, note)
select d.id, d.total_cents, d.document_date, 'transfer', 'Factura final verificada WF-2026-003'
from public.billing_documents d
where d.number = 'WF-2026-003'
  and d.document_type = 'invoice'
  and d.status = 'paid'
  and not exists (
    select 1 from public.billing_payments p where p.document_id = d.id and p.reversed_at is null
  );

insert into public.billing_number_sequences(series, year, last_number)
select 'WF', parsed.year, max(parsed.sequence_number)
from (
  select
    ((regexp_match(number, '^WF-([0-9]{4})-([0-9]+)$'))[1])::integer as year,
    ((regexp_match(number, '^WF-([0-9]{4})-([0-9]+)$'))[2])::integer as sequence_number
  from public.billing_documents
  where number ~ '^WF-[0-9]{4}-[0-9]+$'
) parsed
group by parsed.year
on conflict (series, year) do update
set last_number = greatest(public.billing_number_sequences.last_number, excluded.last_number);

-- Keep future references consistent with the locally verified three-digit
-- invoice series (WF-2026-001, WF-2026-002, WF-2026-003).
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
  update public.billing_documents set number = prefix || sequence_year::text || '-' ||
      lpad(next_number::text, case when sequence_series = 'WF' then 3 else 4 end, '0'),
    status = 'issued', issued_at = timezone('utc', now()) where id = p_document_id returning * into saved;
  return saved;
end;
$$;

commit;
