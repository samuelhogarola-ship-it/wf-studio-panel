import test from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'

import { loadProjectModule } from './helpers/project-harness.mjs'

const summary = {
  totals: { invoiced: 300, collected: 220, expenses: 70, net: 150 },
  counts: { invoices: 2, proposals: 1, pendingInvoices: 1, expenses: 2 },
  areas: {
    general: { invoiced: 200, collected: 120, expenses: 50, net: 70 },
    classes: { invoiced: 100, collected: 100, expenses: 20, net: 80 },
  },
}

test('invoice history applies month, document, status, and area filters and shows the filtered total', async () => {
  let received
  const Page = loadProjectModule('src/app/paneladmin/(protected)/facturas/page.tsx', {
    '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
    '@/lib/data/invoices': { getInvoicesPageData: async (filters) => {
      received = filters
      return { clients: [], invoices: [
        { id: 'invoice-1', number: 'FAC-1', concept: 'Web', amount: 200, payment_method: 'transfer', status: 'paid', issued_at: '2026-10-10', recipient_name: 'Ana', recipient_email: 'ana@example.com', recipient_company: null, document_type: 'invoice', accounting_area: 'general', clients: null },
        { id: 'invoice-2', number: 'FAC-2', concept: 'Clase', amount: 100, payment_method: 'card', status: 'issued', issued_at: '2026-10-20', recipient_name: 'Luis', recipient_email: 'luis@example.com', recipient_company: null, document_type: 'invoice', accounting_area: 'classes', clients: null },
      ], filteredTotal: 300 }
    } },
    '@/components/admin/invoice-form': { InvoiceForm: () => null },
    '@/lib/actions/invoices': { markInvoicePaidAction: async () => ({}) },
  }).default

  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ month: '2026-10', type: 'invoice', status: 'paid', area: 'general' }) }))

  assert.deepEqual(received, { month: '2026-10', type: 'invoice', status: 'paid', area: 'general' })
  for (const name of ['month', 'type', 'status', 'area']) assert.match(html, new RegExp(`name="${name}"`))
  assert.match(html, /2 documentos/)
  assert.match(html, /Total filtrado/)
  assert.match(html, /300,00/)
  assert.match(html, /Limpiar filtros/)
})

test('quarter preparation separates ledgers and links a CSV export for the selected period', async () => {
  const Page = loadProjectModule('src/app/paneladmin/(protected)/billin/trimestres/page.tsx', {
    '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
    '@/lib/data/billin': { getBillinPeriodData: async () => ({ summary, invoices: [], expenses: [] }) },
  }).default
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ year: '2026', quarter: '4' }) }))

  assert.match(html, /Preparación trimestral/)
  assert.match(html, /4\.º trimestre de 2026/)
  assert.match(html, /Contabilidad general/)
  assert.match(html, /Contabilidad de clases/)
  assert.match(html, /href="\/paneladmin\/billin\/trimestres\/export\?year=2026&amp;quarter=4"/)
  assert.match(html, /No sustituye la revisión fiscal profesional/)
})

test('quarter export returns a UTF-8 CSV ledger with professional headers', async () => {
  const { GET } = loadProjectModule('src/app/paneladmin/(protected)/billin/trimestres/export/route.ts', {
    '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
    '@/lib/data/billin': { getBillinPeriodData: async () => ({
      summary,
      invoices: [{ number: 'FAC-1', issued_at: '2026-10-10', document_type: 'invoice', status: 'paid', accounting_area: 'general', concept: 'Web, profesional', amount: 200 }],
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
  assert.match(csv, /"Web, profesional"/)
  assert.match(csv, /Gasto;2026-10-11;Hosting;Servidor;General;Fijo mensual;Pagado;"?50,00"?/)
})
