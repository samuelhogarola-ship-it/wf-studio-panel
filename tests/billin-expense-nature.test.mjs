import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { loadProjectModule } from './helpers/project-harness.mjs'

test('expense nature migration preserves old rows as one-off and restricts supported classifications', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261028190000_billin_expense_nature.sql', import.meta.url), 'utf8')
  assert.match(sql, /expense_nature[^;]+default 'one_off'/is)
  assert.match(sql, /expense_nature[^;]+fixed[^;]+recurring[^;]+one_off/is)
  assert.match(sql, /not null/i)
})

test('expense form offers fixed, recurring variable, and one-off classifications', () => {
  const ExpenseForm = loadProjectModule('src/components/admin/expense-form.tsx', {
    '@/lib/actions/expenses': { createExpenseAction: async () => ({}) },
  }).ExpenseForm
  const html = renderToStaticMarkup(React.createElement(ExpenseForm, { clients: [] }))

  assert.match(html, /name="expense_nature"/)
  assert.match(html, /value="fixed"[^>]*>Fijo mensual/)
  assert.match(html, /value="recurring"[^>]*>Recurrente variable/)
  assert.match(html, /value="one_off"[^>]*selected=""[^>]*>Único/)
})

test('expense action persists a supported nature and rejects an unknown one', async () => {
  const inserts = []
  const { createExpenseAction } = loadProjectModule('src/lib/actions/expenses.ts', {
    '@/lib/auth': { requireAdmin: async () => ({ userId: 'admin-1' }) },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ from() { return { async insert(payload) { inserts.push(payload); return { error: null } } } } }) },
  })
  const build = (nature) => {
    const form = new FormData()
    for (const [key, value] of Object.entries({ supplier: 'Hosting', concept: 'Servidor', category: 'software', accounting_area: 'general', amount: '20', expense_date: '2026-10-28', payment_method: 'card', status: 'paid', expense_nature: nature })) form.set(key, value)
    return form
  }

  assert.match((await createExpenseAction({}, build('weekly'))).error, /Revisa/)
  assert.equal(inserts.length, 0)
  assert.match((await createExpenseAction({}, build('fixed'))).success, /Gasto registrado/)
  assert.equal(inserts[0].expense_nature, 'fixed')
})

test('expense ledger shows the nature of each accounting entry', async () => {
  const Page = loadProjectModule('src/app/paneladmin/(protected)/gastos/page.tsx', {
    '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
    '@/lib/data/expenses': { getExpensesPageData: async () => ({
      clients: [], count: 1, total: 20, page: 0, pageSize: 50,
      expenses: [{ id: 'expense-1', client_id: null, supplier: 'Hosting', concept: 'Servidor', category: 'software', accounting_area: 'general', expense_nature: 'fixed', amount: 20, expense_date: '2026-10-28', status: 'paid', clients: null }],
    }) },
    '@/components/admin/expense-form': { ExpenseForm: () => React.createElement('div') },
  }).default
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))

  assert.match(html, />Fijo mensual</)
})
