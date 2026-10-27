import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { boundary, database, form, loadProjectModule } from './helpers/project-harness.mjs'

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8')
}

test('catalogue actions persist editable products instead of hard-coded session state', async () => {
  const db = database({}, {}, { rpcs: {
    save_billing_product: ({ args }) => ({ data: { id: 'product-1', ...args }, error: null }),
  } })
  const actions = loadProjectModule('src/lib/actions/billing-documents.ts', boundary(db).mocks)
  const result = await actions.saveBillingProductAction({}, form({
    name: 'Web Profesional', description: 'Web completa', default_price: '650', tax_mode: 'taxable', tax_rate: '21', active: 'true', sort_order: '30',
  }))
  assert.equal(result.success, 'Producto guardado.')
  assert.equal(db.calls.find(call => call.table === 'rpc:save_billing_product')?.args.p_default_net_cents, 65_000)
})

test('document action sends editable line snapshots and keeps proposal and invoice types separate', async () => {
  const db = database({}, {}, { rpcs: {
    save_billing_document_draft: ({ args }) => ({ data: { id: 'document-1', document_type: args.p_document_type }, error: null }),
  } })
  const actions = loadProjectModule('src/lib/actions/billing-documents.ts', boundary(db).mocks)
  const result = await actions.saveBillingDocumentAction({}, form({
    document_type: 'proposal', client_id: '', recipient_name: 'SuVilla SL', recipient_email: 'info@example.com', recipient_company: 'SuVilla SL',
    title: 'Propuesta web profesional', document_date: '2026-10-27', lines_json: JSON.stringify([{ productId: null, productName: 'Web Profesional', description: 'Web profesional', quantity: 1, unitNetCents: 65_000, taxMode: 'taxable', taxRateBps: 2_100 }]),
  }))
  assert.equal(result.documentId, 'document-1')
  const args = db.calls.find(call => call.table === 'rpc:save_billing_document_draft')?.args
  assert.equal(args.p_document_type, 'proposal')
  assert.equal(args.p_lines[0].unit_net_cents, 65_000)
})

test('admin workspace exposes catalogue, document editor, totals and payment controls', async () => {
  const [page, products, editor, payment, shell] = await Promise.all([
    source('src/app/paneladmin/(protected)/contabilidad/page.tsx'),
    source('src/components/billing/product-catalogue.tsx'),
    source('src/components/billing/document-editor.tsx'),
    source('src/components/billing/payment-panel.tsx'),
    source('src/components/layout/app-shell.tsx'),
  ])
  assert.match(page, /requireAdmin/)
  assert.match(page, /Documentos y contabilidad|Contabilidad/)
  assert.match(products, /saveBillingProductAction/)
  assert.match(products, /deleteBillingProductAction/)
  assert.match(editor, /proposal/)
  assert.match(editor, /invoice/)
  assert.match(editor, /addLine|Añadir línea/)
  assert.match(editor, /calculateDocument/)
  assert.match(payment, /recordBillingPaymentAction/)
  assert.match(payment, /setBillingPaymentOptionAction/)
  assert.match(shell, /\/paneladmin\/contabilidad/)
})

test('document detail supports issue, printing and recorded balance', async () => {
  const page = await source('src/app/paneladmin/(protected)/contabilidad/documentos/[id]/page.tsx')
  assert.match(page, /issueBillingDocumentAction/)
  assert.match(page, /window\.print|Imprimir/)
  assert.match(page, /PaymentPanel/)
  assert.match(page, /pendiente|balance/i)
  assert.match(page, /safeParse/)
})

test('admin can revoke active shares and reverse recorded payments', async () => {
  const [sharePanel, paymentPanel] = await Promise.all([
    source('src/components/billing/share-panel.tsx'),
    source('src/components/billing/payment-panel.tsx'),
  ])
  assert.match(sharePanel, /revokeBillingShareAction/)
  assert.match(sharePanel, /share_id/)
  assert.match(paymentPanel, /reverseBillingPaymentAction/)
  assert.match(paymentPanel, /payment_id/)
})

test('failed catalogue deletion and document issue surface database errors', async () => {
  for (const [rpc, action, field] of [
    ['delete_billing_product', 'deleteBillingProductAction', 'id'],
    ['issue_billing_document', 'issueBillingDocumentAction', 'document_id'],
  ]) {
    const db = database({}, {}, { rpcs: { [rpc]: () => ({ data: null, error: { message: 'database failure' } }) } })
    const cacheCalls = []
    const actions = loadProjectModule('src/lib/actions/billing-documents.ts', {
      ...boundary(db).mocks,
      'next/cache': { revalidatePath: path => cacheCalls.push(path) },
    })
    await assert.rejects(
      actions[action](form({ [field]: '11111111-1111-4111-8111-111111111111' })),
      /producto|documento/i,
    )
    assert.deepEqual(cacheCalls, [])
  }
})

test('missing catalogue deletion is surfaced before revalidation', async () => {
  const db = database({}, {}, { rpcs: { delete_billing_product: () => ({ data: false, error: null }) } })
  const cacheCalls = []
  const actions = loadProjectModule('src/lib/actions/billing-documents.ts', {
    ...boundary(db).mocks,
    'next/cache': { revalidatePath: path => cacheCalls.push(path) },
  })
  await assert.rejects(actions.deleteBillingProductAction(form({ id: '11111111-1111-4111-8111-111111111111' })), /producto/i)
  assert.deepEqual(cacheCalls, [])
})
