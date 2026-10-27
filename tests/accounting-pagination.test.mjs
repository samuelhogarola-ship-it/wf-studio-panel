import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { loadProjectModule } from './helpers/project-harness.mjs'

test('accounting pagination collects every database page in stable ranges', async () => {
  const pagination = loadProjectModule('src/lib/supabase/pagination.ts')
  const source = Array.from({ length: 1205 }, (_, index) => ({ id: index }))
  const ranges = []
  const rows = await pagination.collectAllRows(async (from, to) => {
    ranges.push([from, to])
    return { data: source.slice(from, to + 1), error: null }
  })
  assert.deepEqual(rows, source)
  assert.deepEqual(ranges, [[0, 499], [500, 999], [1000, 1499]])
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
    assert.match(source, /\.range\(/)
  }
})
