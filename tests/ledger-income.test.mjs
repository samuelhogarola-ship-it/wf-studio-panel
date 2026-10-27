import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { boundary, database, form, loadProjectModule } from './helpers/project-harness.mjs'

test('records exempt class income without VAT and taxable web income at 21 percent', async () => {
  const received = []
  const db = database({}, {}, { rpcs: {
    create_ledger_income: ({ args }) => { received.push(args); return { data: { id: `income-${received.length}` }, error: null } },
  } })
  const actions = loadProjectModule('src/lib/actions/ledger-income.ts', boundary(db).mocks)
  const classes = await actions.createIncomeAction({}, form({ category: 'Clases', description: 'Clases de octubre', occurred_on: '2026-10-27', source_mode: 'individual', net_euros: '100', tax_mode: 'exempt', tax_rate: '21' }))
  const web = await actions.createIncomeAction({}, form({ category: 'Web', description: 'Web profesional', occurred_on: '2026-10-27', source_mode: 'individual', net_euros: '650', tax_mode: 'taxable', tax_rate: '21' }))
  assert.equal(classes.success, 'Ingreso registrado.')
  assert.equal(web.success, 'Ingreso registrado.')
  assert.equal(received[0].p_tax_rate_bps, 0)
  assert.equal(received[1].p_tax_rate_bps, 2_100)
})

test('period summary keeps individual aggregation separate from manual monthly totals', async () => {
  const db = database({ ledger_income: [
    { id: 'i1', occurred_on: '2026-10-03', source_mode: 'individual', category: 'Clases', net_cents: 5000, tax_cents: 0, total_cents: 5000 },
    { id: 'i2', occurred_on: '2026-10-19', source_mode: 'individual', category: 'Clases', net_cents: 7000, tax_cents: 0, total_cents: 7000 },
    { id: 'm1', occurred_on: '2026-10-31', source_mode: 'monthly_summary', category: 'Clases', net_cents: 12000, tax_cents: 0, total_cents: 12000 },
    { id: 'old', occurred_on: '2026-09-30', source_mode: 'individual', category: 'Clases', net_cents: 99900, tax_cents: 0, total_cents: 99900 },
  ] })
  const ledger = loadProjectModule('src/lib/data/ledger.ts', boundary(db).mocks)
  const summary = await ledger.getLedgerSummary({ from: '2026-10-01', to: '2026-10-31' })
  assert.equal(summary.individualTotal, 12_000)
  assert.equal(summary.manualSummaryTotal, 12_000)
  assert.equal('combinedTotal' in summary, false)
})

test('income persistence and UI distinguish individual entries from direct monthly summaries', async () => {
  const [sql, formSource, page] = await Promise.all([
    readFile(new URL('../supabase/migrations/202610270001_internal_billing_workspace.sql', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/billing/income-form.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/paneladmin/(protected)/contabilidad/page.tsx', import.meta.url), 'utf8'),
  ])
  assert.match(sql, /create table public\.ledger_income/i)
  assert.match(sql, /source_mode[\s\S]*individual[\s\S]*monthly_summary/i)
  assert.match(sql, /create or replace function public\.create_ledger_income/i)
  assert.match(formSource, /Registro individual/)
  assert.match(formSource, /Total mensual directo/)
  assert.match(page, /IncomeForm/)
})
