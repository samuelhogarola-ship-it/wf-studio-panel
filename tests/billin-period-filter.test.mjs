import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { loadProjectModule } from './helpers/project-harness.mjs'

test('period filter exposes every accounting preset and custom dates', () => {
  const { BillinPeriodFilter } = loadProjectModule('src/components/admin/billin-period-filter.tsx')
  const html = renderToStaticMarkup(React.createElement(BillinPeriodFilter, {
    action: '/paneladmin/facturas',
    period: { key: 'custom', start: '2026-07-01', end: '2026-08-01', label: 'julio de 2026' },
    preservedParams: {},
  }))

  assert.match(html, /<form[^>]+action="\/paneladmin\/facturas"[^>]+method="get"/)
  for (const value of ['all', 'this-month', 'previous-month', 'this-quarter', 'previous-quarter', 'this-year', 'custom']) {
    assert.match(html, new RegExp(`<option value="${value}"`))
  }
  assert.match(html, /<input(?=[^>]*name="from")(?=[^>]*type="date")(?=[^>]*value="2026-07-01")[^>]*>/)
  assert.match(html, /<input(?=[^>]*name="to")(?=[^>]*type="date")(?=[^>]*value="2026-07-31")[^>]*>/)
  assert.match(html, />Aplicar</)
  assert.match(html, /href="\/paneladmin\/facturas\?period=all"/)
})

test('period filter preserves unrelated filters and resets pagination', () => {
  const { BillinPeriodFilter } = loadProjectModule('src/components/admin/billin-period-filter.tsx')
  const html = renderToStaticMarkup(React.createElement(BillinPeriodFilter, {
    action: '/paneladmin/facturas',
    period: { key: 'this-quarter', start: '2026-10-01', end: '2027-01-01', label: '4.º trimestre de 2026' },
    preservedParams: { type: 'invoice', status: 'paid', area: 'classes', page: '4', period: 'all', month: '2025-01' },
  }))

  assert.match(html, /type="hidden" name="type" value="invoice"/)
  assert.match(html, /type="hidden" name="status" value="paid"/)
  assert.match(html, /type="hidden" name="area" value="classes"/)
  assert.doesNotMatch(html, /name="page"/)
  assert.equal((html.match(/name="period"/g) ?? []).length, 1)
  assert.doesNotMatch(html, /name="month"/)
})
