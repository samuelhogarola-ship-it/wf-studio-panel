import test from 'node:test'
import assert from 'node:assert/strict'

import { monthBounds, quarterBounds } from '../src/lib/billin/periods.mjs'

const now = new Date('2026-10-28T12:00:00Z')

test('month bounds use a half-open range and cross the year boundary', () => {
  assert.deepEqual(monthBounds('2026-12', now), {
    key: '2026-12', start: '2026-12-01', end: '2027-01-01', label: 'diciembre de 2026',
  })
})

test('invalid month falls back to the current UTC month', () => {
  assert.deepEqual(monthBounds('2026-13', now), {
    key: '2026-10', start: '2026-10-01', end: '2026-11-01', label: 'octubre de 2026',
  })
})

test('quarter bounds use exact half-open calendar boundaries', () => {
  assert.deepEqual(quarterBounds('2026', '4', now), {
    year: 2026, quarter: 4, start: '2026-10-01', end: '2027-01-01', label: '4.º trimestre de 2026',
  })
})

test('invalid year and quarter fall back to the current quarter', () => {
  assert.deepEqual(quarterBounds('year', '9', now), {
    year: 2026, quarter: 4, start: '2026-10-01', end: '2027-01-01', label: '4.º trimestre de 2026',
  })
})
