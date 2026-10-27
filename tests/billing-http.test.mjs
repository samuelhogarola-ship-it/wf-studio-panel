import test from 'node:test'
import assert from 'node:assert/strict'

import { loadProjectModule } from './helpers/project-harness.mjs'

test('receipt filenames use an ASCII fallback and an encoded UTF-8 filename', () => {
  const { contentDisposition } = loadProjectModule('src/lib/billing/http.ts')
  assert.equal(
    contentDisposition('inline', 'factura–José\\final.pdf'),
    "inline; filename=\"factura_Jos__final.pdf\"; filename*=UTF-8''factura%E2%80%93Jos%C3%A9%5Cfinal.pdf",
  )
})
