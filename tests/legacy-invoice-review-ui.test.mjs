import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const pageUrl = new URL('../src/app/paneladmin/(protected)/contabilidad/documentos/[id]/page.tsx', import.meta.url)
const exportUrl = new URL('../src/app/api/contabilidad/export/route.ts', import.meta.url)
const typesUrl = new URL('../src/lib/supabase/types.ts', import.meta.url)

test('billing document types expose legacy provenance and the tax review flag', async () => {
  const source = await readFile(typesUrl, 'utf8')
  assert.match(source, /billing_documents:[\s\S]*Row:[^{]*\{[^}]*legacy_invoice_id: string \| null/i)
  assert.match(source, /billing_documents:[\s\S]*Row:[^{]*\{[^}]*tax_breakdown_review_required: boolean/i)
  assert.match(source, /Insert:[^{]*\{[^}]*legacy_invoice_id\?: string \| null/i)
  assert.match(source, /Update:[^{]*\{[^}]*tax_breakdown_review_required\?: boolean/i)
})

test('admin invoice view preserves fiscal-address line breaks and flags ambiguous tax splits', async () => {
  const source = await readFile(pageUrl, 'utf8')
  assert.match(source, /whitespace-pre-line/)
  assert.match(source, /document\.tax_breakdown_review_required\s*\?/)
  assert.match(source, /desglose fiscal pendiente de revisar/i)
})

test('documents CSV exposes a stable fiscal review column', async () => {
  const source = await readFile(exportUrl, 'utf8')
  assert.match(source, /Desglose fiscal pendiente de revisar/i)
  assert.match(source, /item\.tax_breakdown_review_required\s*\?\s*'Sí'\s*:\s*'No'/i)
})
