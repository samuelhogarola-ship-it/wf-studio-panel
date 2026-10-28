import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { loadProjectModule } from './helpers/project-harness.mjs'
import { summarizeBillin } from '../src/lib/billin/summary.mjs'

test('Bill-in summary excludes proposals and void records from money while separating General and Clases', () => {
  const summary = summarizeBillin({
    invoices: [
      { amount: 100, status: 'paid', document_type: 'invoice', accounting_area: 'general' },
      { amount: 50, status: 'issued', document_type: 'invoice', accounting_area: 'general' },
      { amount: 80, status: 'paid', document_type: 'invoice', accounting_area: 'classes' },
      { amount: 500, status: 'issued', document_type: 'proposal', accounting_area: 'classes' },
      { amount: 1_000, status: 'void', document_type: 'invoice', accounting_area: 'general' },
    ],
    expenses: [
      { amount: 40, status: 'paid', accounting_area: 'general' },
      { amount: 20, status: 'paid', accounting_area: 'classes' },
      { amount: 30, status: 'pending', accounting_area: 'classes' },
      { amount: 999, status: 'void', accounting_area: 'general' },
    ],
  })

  assert.deepEqual(summary.totals, { invoiced: 230, collected: 180, expenses: 60, net: 120 })
  assert.deepEqual(summary.counts, { invoices: 3, proposals: 1, pendingInvoices: 1, expenses: 3 })
  assert.deepEqual(summary.areas.general, { invoiced: 150, collected: 100, expenses: 40, net: 60 })
  assert.deepEqual(summary.areas.classes, { invoiced: 80, collected: 80, expenses: 20, net: 60 })
})

test('Bill-in dashboard renders its totals, ledgers, and direct accounting actions', async () => {
  let requestedPeriod
  const Page = loadProjectModule('src/app/paneladmin/(protected)/billin/page.tsx', {
    '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
    '@/lib/data/billin': { getBillinDashboardData: async (period) => {
      requestedPeriod = period
      return ({
      summary: {
        totals: { invoiced: 230, collected: 180, expenses: 60, net: 120 },
        counts: { invoices: 3, proposals: 1, pendingInvoices: 1, expenses: 3 },
        areas: {
          general: { invoiced: 150, collected: 100, expenses: 40, net: 60 },
          classes: { invoiced: 80, collected: 80, expenses: 20, net: 60 },
        },
      },
      recentInvoices: [{ id: 'invoice-1', number: 'FAC-2026-001', concept: 'Web', amount: 100, status: 'paid', document_type: 'invoice', accounting_area: 'general', issued_at: '2026-10-28' }],
      recentExpenses: [{ id: 'expense-1', supplier: 'Hosting', concept: 'Servidor', amount: 40, status: 'paid', accounting_area: 'general', expense_date: '2026-10-27' }],
      })
    } },
  }).default

  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ month: '2026-10' }) }))

  assert.deepEqual(requestedPeriod, { start: '2026-10-01', end: '2026-11-01' })
  assert.match(html, /Resumen de octubre de 2026/)
  assert.match(html, /name="month"/)
  for (const label of ['Facturado', 'Cobrado', 'Gastos pagados', 'Resultado de caja', 'Contabilidad general', 'Contabilidad de clases', 'Facturas y propuestas recientes', 'Gastos recientes']) {
    if (!['Facturas y propuestas recientes', 'Gastos recientes'].includes(label)) assert.match(html, new RegExp(label))
  }
  for (const label of ['Resumen por actividad', 'Movimientos recientes', 'Documento / proveedor', 'Área', 'Estado']) assert.match(html, new RegExp(label))
  assert.doesNotMatch(html, /Facturas y propuestas recientes|Gastos recientes/)
  assert.match(html, /230,00/)
  assert.match(html, /href="\/paneladmin\/facturas"/)
  assert.match(html, /href="\/paneladmin\/gastos"/)
  assert.match(html, /Preparar trimestre/)
})

test('administrator sidebar exposes the Bill-in home before its ledgers', () => {
  const { AdminShell } = loadProjectModule('src/components/layout/app-shell.tsx', {
    '@/lib/i18n': { t: (_locale, key) => key },
  })
  const html = renderToStaticMarkup(React.createElement(AdminShell, {
    title: 'Test', description: 'Test', currentPath: '/paneladmin/billin', userEmail: 'admin@example.com', locale: 'es', children: React.createElement('div'),
  }))

  assert.match(html, /href="\/paneladmin\/billin"[^>]*>[^<]*<svg[\s\S]*?Resumen/)
  assert.ok(html.indexOf('href="/paneladmin/billin"') < html.indexOf('href="/paneladmin/facturas"'))
})
