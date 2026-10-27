import test from 'node:test'
import assert from 'node:assert/strict'

import { loadProjectModule } from './helpers/project-harness.mjs'

const calculations = loadProjectModule('src/lib/billing/calculations.ts')
const schema = loadProjectModule('src/lib/billing/schema.ts')

test('calculates a 650 euro web service with 21 percent VAT in cents', () => {
  assert.deepEqual(
    calculations.calculateLine({ quantity: 1, unitNetCents: 65_000, taxMode: 'taxable', taxRateBps: 2_100 }),
    { netCents: 65_000, taxCents: 13_650, totalCents: 78_650 },
  )
})

test('keeps exempt class income free of tax', () => {
  assert.deepEqual(
    calculations.calculateLine({ quantity: 1, unitNetCents: 5_000, taxMode: 'exempt', taxRateBps: 0 }),
    { netCents: 5_000, taxCents: 0, totalCents: 5_000 },
  )
})

test('derives the remaining balance after a 200 euro plus VAT deposit', () => {
  const invoice = calculations.calculateDocument([
    { quantity: 1, unitNetCents: 65_000, taxMode: 'taxable', taxRateBps: 2_100 },
  ])
  assert.equal(calculations.remainingBalance(invoice.totalCents, [24_200]), 54_450)
})

test('rounds tax per line before summing a document', () => {
  assert.deepEqual(
    calculations.calculateDocument([
      { quantity: 1, unitNetCents: 101, taxMode: 'taxable', taxRateBps: 2_100 },
      { quantity: 1, unitNetCents: 101, taxMode: 'taxable', taxRateBps: 2_100 },
    ]),
    { netCents: 202, taxCents: 42, totalCents: 244 },
  )
})

test('rejects payments that exceed the document total', () => {
  assert.throws(() => calculations.remainingBalance(10_000, [8_000, 2_001]), /excede/i)
})

test('validates editable products, document lines, payments, income and expenses', () => {
  assert.equal(schema.billingProductInputSchema.safeParse({ name: 'Web Profesional', defaultNetCents: 65_000, taxMode: 'taxable', taxRateBps: 2_100 }).success, true)
  assert.equal(schema.billingProductInputSchema.safeParse({ name: 'Web Lite', defaultNetCents: null, taxMode: 'taxable', taxRateBps: 2_100 }).success, true)
  assert.equal(schema.billingLineInputSchema.safeParse({ description: 'Web profesional', quantity: 1, unitNetCents: 65_000, taxMode: 'taxable', taxRateBps: 2_100 }).success, true)
  assert.equal(schema.billingPaymentInputSchema.safeParse({ amountCents: 24_200, paidOn: '2026-10-27', method: 'transfer' }).success, true)
  assert.equal(schema.ledgerIncomeInputSchema.safeParse({ category: 'Clases', description: 'Octubre', occurredOn: '2026-10-27', sourceMode: 'monthly_summary', netCents: 40_000, taxMode: 'exempt', taxRateBps: 0 }).success, true)
  assert.equal(schema.ledgerExpenseInputSchema.safeParse({ supplierName: 'Proveedor', category: 'Software', occurredOn: '2026-10-27', netCents: 1_000, taxRateBps: 2_100, taxCents: 210, deductibleTaxCents: 210, totalCents: 1_210, paymentMethod: 'card' }).success, true)
  assert.equal(schema.billingPaymentInputSchema.safeParse({ amountCents: 0, paidOn: '2026-10-27', method: 'transfer' }).success, false)
})
