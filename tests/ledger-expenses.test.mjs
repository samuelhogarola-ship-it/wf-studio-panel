import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { loadProjectModule } from './helpers/project-harness.mjs'

test('attachment validation accepts real PDF, JPEG, PNG and WebP signatures and rejects oversized files', () => {
  const attachments = loadProjectModule('src/lib/data/expense-attachments.ts')
  const cases = [
    ['application/pdf', [0x25, 0x50, 0x44, 0x46, 0x2d]],
    ['image/jpeg', [0xff, 0xd8, 0xff, 0xe0]],
    ['image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ['image/webp', [...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')]],
  ]
  for (const [type, bytes] of cases) assert.equal(attachments.validateExpenseAttachment(new Uint8Array(bytes), type, bytes.length).valid, true)
  assert.equal(attachments.validateExpenseAttachment(new Uint8Array([1, 2, 3]), 'application/pdf', 3).valid, false)
  assert.equal(attachments.validateExpenseAttachment(new Uint8Array([0x25, 0x50, 0x44, 0x46]), 'application/pdf', 10 * 1024 * 1024 + 1).valid, false)
})

test('expense schema records supplier, tax and deductible values with private attachment metadata', async () => {
  const sql = await readFile(new URL('../supabase/migrations/202610270001_internal_billing_workspace.sql', import.meta.url), 'utf8')
  assert.match(sql, /create table public\.ledger_expenses/i)
  assert.match(sql, /supplier_name[\s\S]*supplier_tax_id[\s\S]*invoice_reference/i)
  assert.match(sql, /deductible_tax_cents/i)
  assert.match(sql, /create table public\.ledger_expense_attachments/i)
  assert.match(sql, /expense-attachments/i)
  assert.match(sql, /values\s*\('expense-attachments',\s*'expense-attachments',\s*false/i)
})

test('expense UI supports receipt upload and download route requires administrator access', async () => {
  const [component, route, action] = await Promise.all([
    readFile(new URL('../src/components/billing/expense-form.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/api/expense-attachments/[id]/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/actions/ledger-expenses.ts', import.meta.url), 'utf8'),
  ])
  assert.match(component, /accept="application\/pdf,image\/jpeg,image\/png,image\/webp"/)
  assert.match(component, /createExpenseAction/)
  assert.match(route, /requireAdmin/)
  assert.match(route, /Cache-Control.*private, no-store/s)
  assert.match(action, /validateExpenseAttachment/)
  assert.match(action, /deductibleTaxCents/)
})
