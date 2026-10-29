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
      { amount: 999, status: 'draft', document_type: 'invoice', accounting_area: 'general' },
    ],
    expenses: [
      { amount: 40, status: 'paid', accounting_area: 'general' },
      { amount: 20, status: 'paid', accounting_area: 'classes' },
      { amount: 30, status: 'pending', accounting_area: 'classes' },
      { amount: 999, status: 'void', accounting_area: 'general' },
    ],
  })

  assert.deepEqual(summary.totals, { invoiced: 230, collected: 180, pending: 50, expenses: 60, net: 120 })
  assert.deepEqual(summary.counts, { invoices: 3, proposals: 1, pendingInvoices: 1, expenses: 3 })
  assert.deepEqual(summary.areas.general, { invoiced: 150, collected: 100, pending: 50, expenses: 40, net: 60 })
  assert.deepEqual(summary.areas.classes, { invoiced: 80, collected: 80, pending: 0, expenses: 20, net: 60 })
})

test('Bill-in attributes collections to paid rows independently from issued documents', () => {
  const summary = summarizeBillin({
    invoices: [{ amount: 200, status: 'issued', document_type: 'invoice', accounting_area: 'general' }],
    collections: [{ amount: 150, status: 'paid', document_type: 'invoice', accounting_area: 'general' }],
    expenses: [],
  })
  assert.deepEqual(summary.totals, { invoiced: 200, collected: 150, pending: 200, expenses: 0, net: 150 })
})

test('Bill-in dashboard renders its totals, ledgers, and direct accounting actions', async () => {
  let requestedPeriod
  const Page = loadProjectModule('src/app/paneladmin/(protected)/billin/page.tsx', {
    '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
    '@/components/layout/app-shell': { AdminShell: ({ header, children, title }) => React.createElement('main', null, header ?? React.createElement('h1', null, title), children) },
    '@/lib/data/billin': { getBillinDashboardData: async (period) => {
      requestedPeriod = period
      return ({
      summary: {
        totals: { invoiced: 230, collected: 180, pending: 50, expenses: 60, net: 120 },
        counts: { invoices: 3, proposals: 1, pendingInvoices: 1, expenses: 3 },
        areas: {
          general: { invoiced: 150, collected: 100, pending: 50, expenses: 40, net: 60 },
          classes: { invoiced: 80, collected: 80, pending: 0, expenses: 20, net: 60 },
        },
      },
      accountBreakdown: {
        general: [{ id: 'bank', name: 'Banco principal', collected: 100, expenses: 40, net: 60 }],
        classes: [{ id: null, name: 'Sin cuenta asignada', collected: 80, expenses: 20, net: 60 }],
      },
      recentInvoices: [{ id: 'invoice-1', number: 'FAC-2026-001', concept: 'Web', amount: 100, status: 'paid', document_type: 'invoice', accounting_area: 'general', issued_at: '2026-10-28' }],
      recentExpenses: [{ id: 'expense-1', supplier: 'Hosting', concept: 'Servidor', amount: 40, status: 'paid', accounting_area: 'general', expense_date: '2026-10-27' }],
      })
    } },
  }).default

  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ month: '2026-10' }) }))

  assert.deepEqual(requestedPeriod, { start: '2026-10-01', end: '2026-11-01' })
  assert.match(html, /Resumen de octubre de 2026/)
  assert.match(html, /name="period"/)
  for (const label of ['Facturado', 'Cobrado', 'Pendiente', 'Gastos pagados', 'Neto', '3 facturas', '1 propuesta', 'Contabilidad general', 'Contabilidad de clases', 'Facturas y propuestas recientes', 'Gastos recientes']) {
    if (!['Facturas y propuestas recientes', 'Gastos recientes'].includes(label)) assert.match(html, new RegExp(label))
  }
  for (const label of ['Resumen por actividad', 'Movimientos recientes', 'Documento / proveedor', 'Área', 'Estado']) assert.match(html, new RegExp(label))
  assert.match(html, /<details/)
  assert.match(html, /Banco principal/)
  assert.match(html, /Sin cuenta asignada/)
  assert.doesNotMatch(html, /Facturas y propuestas recientes|Gastos recientes/)
  assert.match(html, /230,00/)
  assert.match(html, /href="\/paneladmin\/facturas"/)
  assert.match(html, /href="\/paneladmin\/gastos"/)
  assert.match(html, /Preparar trimestre/)
  assert.match(html, /href="\/paneladmin\/facturas"[^>]*>Histórico de facturas/)
  assert.match(html, /data-billin-header="true"/)
})

test('Bill-in dashboard applies historical, quarterly, annual, and custom periods', async () => {
  const cases = [
    [{ period: 'all' }, undefined, 'todo el histórico'],
    [{ period: 'this-quarter' }, { start: '2026-10-01', end: '2027-01-01' }, '4.º trimestre de 2026'],
    [{ period: 'this-year' }, { start: '2026-01-01', end: '2027-01-01' }, 'año 2026'],
    [{ period: 'custom', from: '2026-02-10', to: '2026-02-12' }, { start: '2026-02-10', end: '2026-02-13' }, '10 feb 2026 – 12 feb 2026'],
  ]
  for (const [params, expectedBounds, label] of cases) {
    let requestedPeriod = 'not-called'
    const Page = loadProjectModule('src/app/paneladmin/(protected)/billin/page.tsx', {
      '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
      '@/lib/data/billin': { getBillinDashboardData: async (period) => {
        requestedPeriod = period
        const emptyArea = { invoiced: 0, collected: 0, pending: 0, expenses: 0, net: 0 }
        return { summary: { totals: emptyArea, counts: { invoices: 0, proposals: 0, pendingInvoices: 0, expenses: 0 }, areas: { general: emptyArea, classes: emptyArea } }, accountBreakdown: {}, recentInvoices: [], recentExpenses: [] }
      } },
    }).default
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }))
    assert.deepEqual(requestedPeriod, expectedBounds)
    assert.match(html, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
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
