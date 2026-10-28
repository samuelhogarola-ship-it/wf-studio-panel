import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { clientId, loadProjectModule } from './helpers/project-harness.mjs'

const summary = {
  totals: { invoiced: 300, collected: 220, expenses: 70, net: 150 },
  counts: { invoices: 2, proposals: 1, pendingInvoices: 1, expenses: 2 },
  areas: {
    general: { invoiced: 200, collected: 120, expenses: 50, net: 70 },
    classes: { invoiced: 100, collected: 100, expenses: 20, net: 80 },
  },
}

test('invoice history applies a shared period with document, status, and area filters', async () => {
  let received
  const Page = loadProjectModule('src/app/paneladmin/(protected)/facturas/page.tsx', {
    '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
    '@/lib/data/invoices': { getInvoicesPageData: async (filters) => {
      received = filters
      return { clients: [], invoices: [
        { id: 'invoice-1', number: 'FAC-1', concept: 'Web', amount: 200, payment_method: 'transfer', status: 'paid', issued_at: '2026-10-10', recipient_name: 'Ana', recipient_email: 'ana@example.com', recipient_company: null, document_type: 'invoice', accounting_area: 'general', clients: null },
        { id: 'invoice-2', number: 'FAC-2', concept: 'Clase', amount: 100, payment_method: 'card', status: 'issued', issued_at: '2026-10-20', recipient_name: 'Luis', recipient_email: 'luis@example.com', recipient_company: null, document_type: 'invoice', accounting_area: 'classes', clients: null },
        { id: 'invoice-3', number: 'BOR-1', concept: 'Sin emitir', amount: 999, payment_method: 'transfer', status: 'draft', issued_at: '2026-10-21', recipient_name: 'Eva', recipient_email: 'eva@example.com', recipient_company: null, document_type: 'invoice', accounting_area: 'general', clients: null },
      ], filteredTotal: 300, count: 250, page: 2, pageSize: 100 }
    } },
    '@/components/admin/invoice-form': { InvoiceForm: () => null },
    '@/lib/actions/invoices': { markInvoicePaidAction: async () => ({}) },
    'next/link': { default: ({ href, children, ...props }) => React.createElement('a', { ...props, href: typeof href === 'string' ? href : href.pathname, 'data-query': typeof href === 'object' ? JSON.stringify(href.query) : undefined }, children), __esModule: true },
  }).default

  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ period: 'custom', from: '2026-10-01', to: '2026-10-31', client: clientId, type: 'invoice', status: 'paid', area: 'general', page: '2' }) }))

  assert.deepEqual(received, { start: '2026-10-01', end: '2026-11-01', client: clientId, type: 'invoice', status: 'paid', area: 'general', page: '2' })
  for (const name of ['period', 'from', 'to', 'client', 'type', 'status', 'area']) assert.match(html, new RegExp(`name="${name}"`))
  assert.match(html, /250 documentos/)
  assert.match(html, /Borrador/)
  assert.match(html, /Total filtrado/)
  assert.match(html, /300,00/)
  assert.match(html, /Limpiar filtros/)
  assert.match(html, /data-query="[^"]*period[^"]*custom[^"]*from[^"]*2026-10-01[^"]*to[^"]*2026-10-31/)
})

function queryDatabase() {
  const calls = []
  return { calls, db: { from(table) {
    const call = { table, filters: [] }
    calls.push(call)
    const query = {
      select() { return query }, order() { return query }, eq(name, value) { call.filters.push(['eq', name, value]); return query },
      gte(name, value) { call.filters.push(['gte', name, value]); return query },
      lt(name, value) { call.filters.push(['lt', name, value]); return query }, range() { return query },
      then(resolve) { return Promise.resolve({ data: [], error: null, count: 0 }).then(resolve) },
    }
    return query
  } } }
}

test('invoice data applies identical half-open bounds to rows and totals, and omits them for all history', async () => {
  const bounded = queryDatabase()
  const boundedModule = loadProjectModule('src/lib/data/invoices.ts', {
    '@/lib/supabase/server': { createSupabaseServerClient: async () => bounded.db },
    '@/lib/billin/pagination.mjs': { collectAllPages: async (fetchPage) => fetchPage(0, 999) },
  })
  await boundedModule.getInvoicesPageData({ start: '2026-10-01', end: '2026-11-01', client: clientId, type: 'invoice', status: 'paid', area: 'general' })
  const boundedInvoiceCalls = bounded.calls.filter((call) => call.table === 'invoices')
  assert.equal(boundedInvoiceCalls.length, 2)
  for (const call of boundedInvoiceCalls) {
    assert.deepEqual(call.filters.slice(0, 2), [['gte', 'issued_at', '2026-10-01'], ['lt', 'issued_at', '2026-11-01']])
    assert.ok(call.filters.some((filter) => filter.join(':') === 'eq:document_type:invoice'))
    assert.ok(call.filters.some((filter) => filter.join(':') === 'eq:status:paid'))
    assert.ok(call.filters.some((filter) => filter.join(':') === 'eq:accounting_area:general'))
    assert.ok(call.filters.some((filter) => filter.join(':') === `eq:client_id:${clientId}`))
  }

  const historical = queryDatabase()
  const historicalModule = loadProjectModule('src/lib/data/invoices.ts', {
    '@/lib/supabase/server': { createSupabaseServerClient: async () => historical.db },
    '@/lib/billin/pagination.mjs': { collectAllPages: async (fetchPage) => fetchPage(0, 999) },
  })
  await historicalModule.getInvoicesPageData({})
  assert.ok(historical.calls.filter((call) => call.table === 'invoices').every((call) => call.filters.every(([operator]) => operator !== 'gte' && operator !== 'lt')))
})

test('quarter preparation separates ledgers and links a CSV export for the selected period', async () => {
  const Page = loadProjectModule('src/app/paneladmin/(protected)/billin/trimestres/page.tsx', {
    '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
    '@/lib/data/billin': { getBillinPeriodData: async () => ({ summary, invoices: [{ id: 'draft', number: 'BOR-1', concept: 'Sin emitir', amount: 99, status: 'draft', document_type: 'invoice', accounting_area: 'general', issued_at: '2026-10-15' }], collections: [], expenses: [] }) },
  }).default
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ year: '2026', quarter: '4' }) }))

  assert.match(html, /Preparación trimestral/)
  assert.match(html, /4\.º trimestre de 2026/)
  assert.match(html, /Contabilidad general/)
  assert.match(html, /Contabilidad de clases/)
  assert.match(html, /href="\/paneladmin\/billin\/trimestres\/export\?year=2026&amp;quarter=4"/)
  assert.match(html, /No sustituye la revisión fiscal profesional/)
  assert.match(html, /Borrador/)
})

test('quarter export returns a UTF-8 CSV ledger with professional headers', async () => {
  const { GET } = loadProjectModule('src/app/paneladmin/(protected)/billin/trimestres/export/route.ts', {
    '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
    '@/lib/data/billin': { getBillinPeriodData: async () => ({
      summary,
      invoices: [{ number: 'FAC-1', issued_at: '2026-10-10', document_type: 'invoice', status: 'paid', accounting_area: 'general', concept: '=1+1', amount: 200 }, { number: 'BOR-1', issued_at: '2026-10-12', document_type: 'invoice', status: 'draft', accounting_area: 'general', concept: 'Sin emitir', amount: 99 }],
      collections: [],
      expenses: [{ expense_date: '2026-10-11', supplier: 'Hosting', concept: 'Servidor', status: 'paid', accounting_area: 'general', expense_nature: 'fixed', amount: 50 }],
    }) },
  })
  const response = await GET(new Request('http://localhost/paneladmin/billin/trimestres/export?year=2026&quarter=4'))
  const bytes = new Uint8Array(await response.arrayBuffer())
  const csv = new TextDecoder().decode(bytes)

  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /text\/csv/)
  assert.match(response.headers.get('content-disposition'), /billin-2026-t4\.csv/)
  assert.deepEqual([...bytes.slice(0, 3)], [0xEF, 0xBB, 0xBF])
  assert.match(csv, /Tipo;Fecha;Documento\/Proveedor;Concepto;Área;Clasificación;Estado;Importe/)
  assert.match(csv, /;'=1\+1;/)
  assert.match(csv, /BOR-1;Sin emitir;General;Factura;Borrador/)
  assert.match(csv, /Gasto;2026-10-11;Hosting;Servidor;General;Fijo mensual;Pagado;"?50,00"?/)
})
