import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { loadProjectModule } from './helpers/project-harness.mjs'

test('accounting pagination uses a stable cursor when rows are inserted between pages', async () => {
  const pagination = loadProjectModule('src/lib/supabase/pagination.ts')
  const original = Array.from({ length: 1_205 }, (_, index) => ({ id: String(index).padStart(4, '0') }))
  const source = [...original]
  let calls = 0
  const rows = await pagination.collectAllRows(async (cursor, limit) => {
    calls += 1
    if (calls === 2) source.unshift({ id: '-001' })
    const page = source.filter(row => cursor === null || row.id > cursor).slice(0, limit)
    return { data: page, error: null }
  }, row => row.id)
  assert.deepEqual(rows, original)
  assert.equal(calls, 3)
})

test('accounting queries filter dates in Postgres and paginate before rendering', async () => {
  const [route, ledger] = await Promise.all([
    readFile(new URL('../src/app/api/contabilidad/export/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/data/ledger.ts', import.meta.url), 'utf8'),
  ])
  for (const source of [route, ledger]) {
    assert.match(source, /collectAllRows/)
    assert.match(source, /\.gte\(/)
    assert.match(source, /\.lte\(/)
    assert.match(source, /\.limit\(/)
    assert.match(source, /\.or\(/)
  }
})
