import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { loadProjectModule } from './helpers/project-harness.mjs'

test('Spanish-compatible CSV uses semicolons, decimal commas, quotes and a UTF-8 BOM', () => {
  const csv = loadProjectModule('src/lib/billing/csv.ts')
  const output = csv.createSpanishCsv(['Concepto', 'Importe'], [['Web "Profesional"; completa', 65000]])
  assert.equal(output.charCodeAt(0), 0xfeff)
  assert.match(output, /Concepto;Importe/)
  assert.match(output, /"Web ""Profesional""; completa";650,00/)
  assert.match(csv.createSpanishCsv(['Concepto'], [['=HYPERLINK("bad")']]), /'=HYPERLINK/)
  assert.match(csv.createSpanishCsv(['Concepto'], [['\t=HYPERLINK("bad")']]), /'\t=HYPERLINK/)
  assert.match(csv.createSpanishCsv(['Concepto'], [['\r=HYPERLINK("bad")']]), /'\r=HYPERLINK/)
})

test('month, quarter and year boundaries are exact calendar ranges', () => {
  const csv = loadProjectModule('src/lib/billing/csv.ts')
  assert.deepEqual(csv.resolveAccountingPeriod({ mode: 'month', year: 2026, month: 2 }), { from: '2026-02-01', to: '2026-02-28', label: 'Febrero 2026' })
  assert.deepEqual(csv.resolveAccountingPeriod({ mode: 'quarter', year: 2026, quarter: 4 }), { from: '2026-10-01', to: '2026-12-31', label: '4º trimestre 2026' })
  assert.deepEqual(csv.resolveAccountingPeriod({ mode: 'year', year: 2026 }), { from: '2026-01-01', to: '2026-12-31', label: 'Año 2026' })
})

test('authenticated export route exposes required datasets and accounting columns', async () => {
  const [route, page, summary, readme] = await Promise.all([
    readFile(new URL('../src/app/api/contabilidad/export/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/paneladmin/(protected)/contabilidad/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/billing/period-summary.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../README.md', import.meta.url), 'utf8'),
  ])
  assert.match(route, /requireAdmin/)
  for (const dataset of ['documents', 'payments', 'income', 'expenses']) assert.match(route, new RegExp(dataset))
  for (const column of ['Número', 'Fecha', 'Base', 'IVA', 'Total', 'Proveedor', 'IVA deducible']) assert.match(route, new RegExp(column))
  assert.match(page, /searchParams/)
  assert.match(summary, /Mensual|Trimestral|Anual/)
  assert.match(summary, /export/)
  assert.match(readme, /Contabilidad interna|contabilidad/i)
})
