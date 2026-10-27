import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { boundary, database, form, loadProjectModule } from './helpers/project-harness.mjs'

test('records a partial collection and returns its linked advance invoice draft', async () => {
  const db = database({}, {}, { rpcs: {
    record_billing_payment: ({ args }) => ({ data: [{ payment_id: 'pay-1', balance_cents: 54_450, advance_invoice_id: 'advance-1', received: args }], error: null }),
  } })
  const actions = loadProjectModule('src/lib/actions/billing-payments.ts', boundary(db).mocks)
  const result = await actions.recordBillingPaymentAction({}, form({
    document_id: '11111111-1111-4111-8111-111111111111', amount_cents: 24_200,
    paid_on: '2026-10-27', method: 'transfer', note: 'Entrada',
  }))

  assert.equal(result.success, 'Cobro registrado.')
  assert.equal(result.advanceInvoiceId, 'advance-1')
  assert.deepEqual(db.calls.find(call => call.table === 'rpc:record_billing_payment')?.args, {
    p_document_id: '11111111-1111-4111-8111-111111111111', p_amount_cents: 24_200,
    p_paid_on: '2026-10-27', p_method: 'transfer', p_note: 'Entrada',
  })
})

test('rejects invalid collections before calling the database', async () => {
  const db = database()
  const actions = loadProjectModule('src/lib/actions/billing-payments.ts', boundary(db).mocks)
  const result = await actions.recordBillingPaymentAction({}, form({
    document_id: '11111111-1111-4111-8111-111111111111', amount_cents: 0,
    paid_on: '2026-10-27', method: 'transfer',
  }))
  assert.match(result.error, /importe/i)
  assert.equal(db.calls.some(call => call.operation === 'rpc'), false)
})

test('activates a manual HTTPS link, transfer or cash without provider lock-in', async () => {
  const calls = []
  const db = database({}, {}, { rpcs: {
    set_billing_payment_option: ({ args }) => { calls.push(args); return { data: true, error: null } },
  } })
  const actions = loadProjectModule('src/lib/actions/billing-payments.ts', boundary(db).mocks)
  for (const values of [
    { method: 'manual_link', payment_url: 'https://payments.example.com/suvilla', instructions: '' },
    { method: 'transfer', payment_url: '', instructions: 'ES57 1563 2626 3232 6412 0309' },
    { method: 'cash', payment_url: '', instructions: 'Pago en efectivo' },
  ]) {
    const result = await actions.setBillingPaymentOptionAction({}, form({ document_id: '11111111-1111-4111-8111-111111111111', active: 'true', ...values }))
    assert.equal(result.success, 'Forma de pago actualizada.')
  }
  assert.deepEqual(calls.map(call => call.p_method), ['manual_link', 'transfer', 'cash'])
})

test('database enforces balances, reversals and one advance invoice per proposal payment', async () => {
  const sql = await readFile(new URL('../supabase/migrations/202610270003_internal_billing_workspace.sql', import.meta.url), 'utf8')
  assert.match(sql, /create table public\.billing_payments/i)
  assert.match(sql, /create table public\.billing_payment_options/i)
  assert.match(sql, /create or replace function public\.record_billing_payment/i)
  assert.match(sql, /if paid_total \+ p_amount_cents > document_row\.total_cents/i)
  assert.match(sql, /document_row\.document_type = 'proposal'[\s\S]*advance_invoice/i)
  assert.match(sql, /create or replace function public\.reverse_billing_payment/i)
  assert.match(sql, /create or replace function public\.set_billing_payment_option/i)
  assert.match(sql, /p_url !~ '\^https:\/\/'/i)
  assert.match(sql, /p\.document_id = d\.id[\s\S]*p\.advance_invoice_id = d\.id/i)
})

test('failed payment reversal is surfaced and does not revalidate', async () => {
  const db = database({}, {}, { rpcs: {
    reverse_billing_payment: () => ({ data: null, error: { message: 'database failure' } }),
  } })
  const cacheCalls = []
  const actions = loadProjectModule('src/lib/actions/billing-payments.ts', {
    ...boundary(db).mocks,
    'next/cache': { revalidatePath: path => cacheCalls.push(path) },
  })
  await assert.rejects(
    actions.reverseBillingPaymentAction(form({ payment_id: '11111111-1111-4111-8111-111111111111' })),
    /cobro/i,
  )
  assert.deepEqual(cacheCalls, [])
})
