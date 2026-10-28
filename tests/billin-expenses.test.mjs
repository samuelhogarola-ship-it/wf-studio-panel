import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { clientId, loadProjectModule } from './helpers/project-harness.mjs'

test('Bill-in expenses migration is administrator-only and class-aware', async () => {
  const sql = await readFile(new URL('../supabase/migrations/202610280002_billin_expenses.sql', import.meta.url), 'utf8')

  assert.match(sql, /create table public\.expenses/i)
  assert.match(sql, /accounting_area[^;]+general[^;]+classes/is)
  assert.match(sql, /amount[^;]+check \(amount > 0\)/is)
  assert.match(sql, /create policy expenses_admin_all/i)
  assert.match(sql, /private\.is_admin\(\)/i)
})

test('expense form preselects a CRM client and exposes the classes ledger', () => {
  const ExpenseForm = loadProjectModule('src/components/admin/expense-form.tsx', {
    '@/lib/actions/expenses': { createExpenseAction: async () => ({}) },
  }).ExpenseForm
  const html = renderToStaticMarkup(React.createElement(ExpenseForm, {
    clients: [{ id: clientId, name: 'Ángel', status: 'active' }],
    defaultClientId: clientId,
  }))

  assert.match(html, new RegExp(`<option value="${clientId}" selected="">`))
  assert.match(html, /value="classes"/)
  assert.match(html, />Clases</)
  assert.match(html, /name="supplier"/)
  assert.match(html, /name="amount"/)
})

test('Bill-in expense action validates before writing and persists a valid entry', async () => {
  const inserts = []
  const { createExpenseAction } = loadProjectModule('src/lib/actions/expenses.ts', {
    '@/lib/auth': { requireAdmin: async () => ({ userId: 'admin-1' }) },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({
      from(table) {
        assert.equal(table, 'expenses')
        return { async insert(payload) { inserts.push(payload); return { error: null } } }
      },
    }) },
  })

  const invalid = new FormData()
  invalid.set('supplier', 'Proveedor')
  invalid.set('amount', '-10')
  assert.match((await createExpenseAction({}, invalid)).error, /Revisa/)
  assert.equal(inserts.length, 0)

  const valid = new FormData()
  for (const [key, value] of Object.entries({
    client_id: clientId, supplier: 'Proveedor', concept: 'Material de clase', category: 'classes',
    accounting_area: 'classes', amount: '35.50', expense_date: '2026-10-28', payment_method: 'card',
    status: 'paid', notes: 'Ticket guardado',
  })) valid.set(key, value)

  assert.match((await createExpenseAction({}, valid)).success, /Gasto registrado/)
  assert.deepEqual(inserts[0], {
    client_id: clientId, supplier: 'Proveedor', concept: 'Material de clase', category: 'classes',
    accounting_area: 'classes', amount: 35.5, expense_date: '2026-10-28', payment_method: 'card',
    expense_nature: 'one_off', billing_account_id: null, status: 'paid', notes: 'Ticket guardado', created_by: 'admin-1',
  })
})
