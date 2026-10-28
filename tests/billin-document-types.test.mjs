import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { clientId, loadProjectModule } from './helpers/project-harness.mjs'

test('Bill-in stores proposals separately from invoices and keeps a classes accounting area', async () => {
  const sql = await readFile(new URL('../supabase/migrations/202610280003_billin_document_types.sql', import.meta.url), 'utf8')
  assert.match(sql, /document_type[^;]+invoice[^;]+proposal/is)
  assert.match(sql, /accounting_area[^;]+general[^;]+classes/is)
  assert.match(sql, /next_proposal_number/i)
  assert.match(sql, /create_billing_document_draft/i)
  assert.match(sql, /document_type\s*=\s*'invoice'/i)
})

test('invoice form can issue a proposal or invoice and explains transfer versus Stripe card payment', () => {
  const InvoiceForm = loadProjectModule('src/components/admin/invoice-form.tsx', {
    '@/lib/actions/invoices': { createInvoiceAction: async () => ({}) },
  }).InvoiceForm
  const html = renderToStaticMarkup(React.createElement(InvoiceForm, {
    clients: [{ id: clientId, name: 'Ángel', company: 'Agama', email: 'angel@example.com', status: 'active' }],
    locale: 'es', defaultClientId: clientId,
  }))

  assert.match(html, /name="document_type"/)
  assert.match(html, /value="proposal"/)
  assert.match(html, /name="accounting_area"/)
  assert.match(html, /name="transfer_instructions"/)
  assert.match(html, /Stripe/i)
})

test('invoice action uses the Bill-in document lifecycle', async () => {
  const source = await readFile(new URL('../src/lib/actions/invoices.ts', import.meta.url), 'utf8')
  assert.match(source, /create_billing_document_draft/)
  assert.match(source, /issue_billing_document/)
  assert.match(source, /document_type/)
  assert.match(source, /accounting_area/)
})
