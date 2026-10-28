import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { loadProjectModule } from './helpers/project-harness.mjs'
import { summarizeAccounts } from '../src/lib/billin/summary.mjs'

test('Bill-in accounts migration is admin-only and links both ledgers without breaking history', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261028200000_billin_accounts.sql', import.meta.url), 'utf8')
  assert.match(sql, /create table(?: if not exists)? public\.billing_accounts/i)
  assert.match(sql, /account_type[^;]+bank[^;]+stripe[^;]+cash[^;]+other/is)
  assert.match(sql, /create policy billing_accounts_admin_all[\s\S]*private\.is_admin\(\)/i)
  assert.match(sql, /alter table public\.invoices[\s\S]*billing_account_id uuid[\s\S]*references public\.billing_accounts/i)
  assert.match(sql, /alter table public\.expenses[\s\S]*billing_account_id uuid[\s\S]*references public\.billing_accounts/i)
  assert.match(sql, /create_billing_document_draft[\s\S]*p_billing_account_id uuid/i)
})

test('invoice and expense forms allow selecting the Supabase account used for the movement', () => {
  const account = { id: '55555555-5555-4555-8555-555555555555', name: 'Banco principal', account_type: 'bank', status: 'active' }
  const InvoiceForm = loadProjectModule('src/components/admin/invoice-form.tsx', { '@/lib/actions/invoices': { createInvoiceAction: async () => ({}) } }).InvoiceForm
  const ExpenseForm = loadProjectModule('src/components/admin/expense-form.tsx', { '@/lib/actions/expenses': { createExpenseAction: async () => ({}) } }).ExpenseForm
  const invoice = renderToStaticMarkup(React.createElement(InvoiceForm, { clients: [], accounts: [account], locale: 'es' }))
  const expense = renderToStaticMarkup(React.createElement(ExpenseForm, { clients: [], accounts: [account] }))

  for (const html of [invoice, expense]) {
    assert.match(html, /name="billing_account_id"/)
    assert.match(html, new RegExp(`value="${account.id}"`))
    assert.match(html, /Banco principal/)
  }
})

test('account breakdown separates General and Clases and preserves unassigned historic money', () => {
  const summary = summarizeAccounts({
    accounts: [{ id: 'bank', name: 'Banco principal' }, { id: 'stripe', name: 'Stripe' }],
    invoices: [
      { amount: 100, status: 'paid', document_type: 'invoice', accounting_area: 'general', billing_account_id: 'bank' },
      { amount: 30, status: 'paid', document_type: 'invoice', accounting_area: 'general', billing_account_id: null },
      { amount: 50, status: 'paid', document_type: 'invoice', accounting_area: 'classes', billing_account_id: 'stripe' },
      { amount: 90, status: 'issued', document_type: 'invoice', accounting_area: 'general', billing_account_id: 'bank' },
    ],
    expenses: [{ amount: 20, status: 'paid', accounting_area: 'general', billing_account_id: 'bank' }],
  })

  assert.deepEqual(summary.general, [
    { id: 'bank', name: 'Banco principal', collected: 100, expenses: 20, net: 80 },
    { id: null, name: 'Sin cuenta asignada', collected: 30, expenses: 0, net: 30 },
  ])
  assert.deepEqual(summary.classes, [{ id: 'stripe', name: 'Stripe', collected: 50, expenses: 0, net: 50 }])
})

test('Bill-in account management page creates named bank, Stripe, cash, and other destinations', async () => {
  const Page = loadProjectModule('src/app/paneladmin/(protected)/billin/cuentas/page.tsx', {
    '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
    '@/lib/data/billin': { getBillingAccounts: async () => [{ id: 'bank', name: 'Banco principal', account_type: 'bank', details: 'ES00…1234', status: 'active' }] },
    '@/components/admin/billing-account-form': { BillingAccountForm: () => React.createElement('div', { 'data-account-form': true }) },
  }).default
  const html = renderToStaticMarkup(await Page())
  assert.match(html, /Cuentas de Bill-in/)
  assert.match(html, /Banco principal/)
  assert.match(html, /data-account-form="true"/)
})
