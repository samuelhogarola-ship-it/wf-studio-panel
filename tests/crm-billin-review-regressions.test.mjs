import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('client records and global messages stay inside the WF Studio CRM', async () => {
  const admin = await source('src/lib/data/admin.ts')
  assert.match(admin, /from\('clients'\)[\s\S]*?eq\('id', clientId\)[\s\S]*?eq\('project', 'wf-studio'\)/)
  assert.match(admin, /from\('services'\)/)
  assert.match(admin, /from\('invoices'\)/)
  assert.match(admin, /from\('expenses'\)/)
  assert.match(admin, /clients!inner\(name, project\)/)
  assert.match(admin, /eq\('clients\.project', 'wf-studio'\)/)
})

test('client record links to real services, invoices and expenses and anchors the composer', async () => {
  const page = await source('src/app/paneladmin/(protected)/clientes/[id]/page.tsx')
  for (const section of ['Servicios registrados', 'Facturas y propuestas', 'Gastos relacionados']) assert.match(page, new RegExp(section))
  assert.ok(page.indexOf('COMUNICACIÓN') < page.indexOf('id="mensajes"'))
})

test('proposals cannot inherit payment links or unpaid invoice semantics', async () => {
  const sql = (await Promise.all([
    source('supabase/migrations/202610280004_billin_crm_hardening.sql'),
    source('supabase/migrations/202610280005_proposal_payment_guard.sql'),
  ])).join('\n')
  const action = await source('src/lib/actions/invoices.ts')
  const page = await source('src/app/paneladmin/(protected)/facturas/page.tsx')
  assert.match(sql, /document_type\s*=\s*'proposal'[\s\S]*payment link/i)
  assert.match(sql, /delete from public\.payment_links/i)
  assert.match(sql, /create trigger payment_links_reject_proposals/i)
  assert.match(sql, /issue_invoice_with_payment_link[\s\S]*document_type\s*<>\s*'invoice'/i)
  assert.ok(action.indexOf("documentType === 'proposal'") < action.indexOf("create_billing_document_draft"))
  assert.match(page, /document_type === 'proposal' \? 'Emitida'/)
  const form = await source('src/components/admin/invoice-form.tsx')
  assert.match(form, /documentType === 'invoice'[\s\S]*payment_url/)
})

test('expense ledger paginates and totals the complete filtered ledger', async () => {
  const data = await source('src/lib/data/expenses.ts')
  const page = await source('src/app/paneladmin/(protected)/gastos/page.tsx')
  assert.doesNotMatch(data, /\.limit\(250\)/)
  assert.match(data, /count: 'exact'/)
  assert.match(data, /\.range\(/)
  assert.match(data, /get_expense_ledger_summary/)
  assert.match(page, /Página siguiente/)
  assert.match(page, /Total del histórico/)
})
