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

test('expense history uses the shared period and keeps it in pagination', async () => {
  let received
  const Page = loadProjectModule('src/app/paneladmin/(protected)/gastos/page.tsx', {
    '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
    '@/lib/data/expenses': { getExpensesPageData: async (filters) => {
      received = filters
      return { clients: [], accounts: [], expenses: [], count: 120, total: 450, page: 1, pageSize: 50 }
    } },
    '@/components/admin/expense-form': { ExpenseForm: () => null },
  }).default

  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ period: 'custom', from: '2026-10-01', to: '2026-10-31', area: 'classes', page: '2' }) }))
  assert.deepEqual(received, { area: 'classes', page: 1, start: '2026-10-01', end: '2026-11-01' })
  for (const name of ['period', 'from', 'to', 'area']) assert.match(html, new RegExp(`name="${name}"`))
  assert.match(html, /Total de 1 oct 2026 – 31 oct 2026:/)
  assert.match(html, /href="\/paneladmin\/gastos\?period=custom&amp;from=2026-10-01&amp;to=2026-10-31&amp;area=classes&amp;page=1"/)
})

function expenseQueryDatabase() {
  const calls = []
  return { calls, db: {
    from(table) {
      const call = { table, filters: [] }
      calls.push(call)
      const query = {
        select() { return query }, order() { return query }, eq(name, value) { call.filters.push(['eq', name, value]); return query },
        gte(name, value) { call.filters.push(['gte', name, value]); return query },
        lt(name, value) { call.filters.push(['lt', name, value]); return query }, range() { return query },
        then(resolve) { return Promise.resolve({ data: [], error: null, count: 0 }).then(resolve) },
      }
      return query
    },
    async rpc() { return { data: [{ total: 0 }], error: null } },
  } }
}

test('expense data bounds both listed rows and the paid amount total', async () => {
  const fake = expenseQueryDatabase()
  const { getExpensesPageData } = loadProjectModule('src/lib/data/expenses.ts', {
    '@/lib/supabase/server': { createSupabaseServerClient: async () => fake.db },
    '@/lib/billin/pagination.mjs': { collectAllPages: async (fetchPage) => fetchPage(0, 999) },
  })
  await getExpensesPageData({ area: 'classes', page: 0, start: '2026-10-01', end: '2026-11-01' })
  const expenseCalls = fake.calls.filter((call) => call.table === 'expenses')
  assert.equal(expenseCalls.length, 2)
  for (const call of expenseCalls) {
    assert.ok(call.filters.some((filter) => filter.join(':') === 'gte:expense_date:2026-10-01'))
    assert.ok(call.filters.some((filter) => filter.join(':') === 'lt:expense_date:2026-11-01'))
    assert.ok(call.filters.some((filter) => filter.join(':') === 'eq:accounting_area:classes'))
  }
  assert.ok(expenseCalls[1].filters.some((filter) => filter.join(':') === 'eq:status:paid'))
})
