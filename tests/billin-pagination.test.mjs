import test from 'node:test'
import assert from 'node:assert/strict'

import { collectAllPages } from '../src/lib/billin/pagination.mjs'

test('Bill-in collects every Supabase page beyond the default 1000 row limit', async () => {
  const source = Array.from({ length: 2_105 }, (_, id) => ({ id }))
  const calls = []
  const rows = await collectAllPages(async (from, to) => {
    calls.push([from, to])
    return source.slice(from, to + 1)
  })
  assert.equal(rows.length, 2_105)
  assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]])
})
