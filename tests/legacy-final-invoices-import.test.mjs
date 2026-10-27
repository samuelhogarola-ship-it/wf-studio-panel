import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationUrl = new URL('../supabase/migrations/202610270002_import_legacy_final_invoices.sql', import.meta.url)

test('legacy invoices gain an idempotent provenance link and explicit tax-review state', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  assert.match(sql, /add column if not exists legacy_invoice_id uuid references public\.invoices\(id\) on delete restrict/i)
  assert.match(sql, /create unique index if not exists billing_documents_legacy_invoice_unique[\s\S]*legacy_invoice_id is not null/i)
  assert.match(sql, /add column if not exists tax_breakdown_review_required boolean not null default false/i)
})

test('the import preserves invoice snapshots and never creates proposals', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  for (const sourceColumn of ['client_id', 'recipient_name', 'recipient_email', 'recipient_company', 'concept', 'notes', 'issued_at']) {
    assert.match(sql, new RegExp(`i\\.${sourceColumn}`, 'i'))
  }
  assert.match(sql, /insert into public\.billing_documents[\s\S]*?select\s+'invoice'/i)
  assert.doesNotMatch(sql, /(?:select|values)\s*\(?'proposal'[\s,]/i)
  assert.match(sql, /tax_breakdown_review_required[\s\S]*true/i)
  assert.match(sql, /desglose fiscal pendiente de revisar/i)
  assert.match(sql, /where not exists[\s\S]*billing_document_lines/i)
})

test('existing references are reconciled safely and legacy states and payments are mapped', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  assert.match(sql, /billing document number conflict|conflicto.*número/i)
  for (const status of ['draft', 'issued', 'paid', 'void']) assert.match(sql, new RegExp(`'${status}'`, 'i'))
  assert.match(sql, /case i\.payment_method[\s\S]*'cash'[\s\S]*'card'[\s\S]*'transfer'/i)
  assert.match(sql, /where not exists[\s\S]*billing_payments/i)
})

test('the three verified final invoices use exact totals and one full payment', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  assert.match(sql, /WF-2026-001[\s\S]*J29227907[\s\S]*20000[\s\S]*4200[\s\S]*24200/i)
  assert.match(sql, /WF-2026-002[\s\S]*B93154425[\s\S]*65000[\s\S]*13650[\s\S]*78650/i)
  assert.match(sql, /WF-2026-003[\s\S]*B92371301[\s\S]*20000[\s\S]*4200[\s\S]*24200/i)
  assert.match(sql, /status = 'paid'/i)
  assert.match(sql, /amount_cents[\s\S]*total_cents/i)
})

test('invoice sequence is reserved from the greatest imported WF reference', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  assert.match(sql, /regexp_match\(number, '.*WF-/is)
  assert.match(sql, /billing_number_sequences[\s\S]*greatest/i)
  assert.match(sql, /lpad\(next_number::text, 3, '0'\)/i)
})

test('Postgres imports and replays the legacy invoice set without duplicates', { skip: !process.env.WF_SUPPORT_TEST_DATABASE_URL }, async () => {
  const { Client } = await import('pg')
  const database = new Client({ connectionString: process.env.WF_SUPPORT_TEST_DATABASE_URL })
  const sql = await readFile(migrationUrl, 'utf8')
  const numbers = ['WF-2026-001', 'WF-2026-002', 'WF-2026-003', 'WF-2025-010', 'WF-2025-011', 'WF-2025-012', 'WF-2025-013']
  await database.connect()
  try {
    const readDocuments = () => database.query(`
      select d.number, d.document_type, d.status, d.recipient_company,
        d.net_cents, d.tax_cents, d.total_cents, d.tax_breakdown_review_required,
        count(distinct l.id)::integer as line_count,
        count(distinct p.id) filter (where p.reversed_at is null)::integer as payment_count,
        coalesce(sum(distinct p.amount_cents) filter (where p.reversed_at is null), 0)::bigint as paid_cents
      from public.billing_documents d
      left join public.billing_document_lines l on l.document_id = d.id
      left join public.billing_payments p on p.document_id = d.id
      where d.number = any($1::text[])
      group by d.id
      order by d.number
    `, [numbers])

    const before = (await readDocuments()).rows
    assert.equal(before.length, numbers.length)
    assert.ok(before.every(row => row.document_type === 'invoice' && row.line_count === 1))

    const byNumber = Object.fromEntries(before.map(row => [row.number, row]))
    assert.deepEqual(
      ['WF-2025-010', 'WF-2025-011', 'WF-2025-012', 'WF-2025-013'].map(number => byNumber[number].status),
      ['draft', 'issued', 'paid', 'void'],
    )
    assert.equal(byNumber['WF-2025-010'].recipient_company, 'Cliente histórico\nCIF: X0000001A\nCalle Uno')
    assert.equal(byNumber['WF-2025-010'].tax_breakdown_review_required, true)
    assert.equal(byNumber['WF-2025-012'].payment_count, 1)
    assert.equal(Number(byNumber['WF-2025-012'].paid_cents), Number(byNumber['WF-2025-012'].total_cents))

    for (const [number, totals] of Object.entries({
      'WF-2026-001': [20000, 4200, 24200],
      'WF-2026-002': [65000, 13650, 78650],
      'WF-2026-003': [20000, 4200, 24200],
    })) {
      const row = byNumber[number]
      assert.deepEqual([row.net_cents, row.tax_cents, row.total_cents].map(Number), totals)
      assert.equal(row.status, 'paid')
      assert.equal(row.tax_breakdown_review_required, false)
      assert.equal(row.payment_count, 1)
      assert.equal(Number(row.paid_cents), Number(row.total_cents))
    }

    assert.deepEqual((await database.query(`
      select year, last_number from public.billing_number_sequences
      where series = 'WF' and year in (2025, 2026) order by year
    `)).rows, [{ year: 2025, last_number: 13 }, { year: 2026, last_number: 3 }])

    await database.query(sql)
    const after = (await readDocuments()).rows
    assert.deepEqual(after, before)
  } finally {
    await database.end()
  }
})
