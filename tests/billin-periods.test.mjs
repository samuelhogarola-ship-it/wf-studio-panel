import test from 'node:test'
import assert from 'node:assert/strict'

import { monthBounds, quarterBounds, resolveAccountingPeriod } from '../src/lib/billin/periods.mjs'

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

test('accounting periods resolve all supported presets with UTC half-open bounds', () => {
  assert.deepEqual(resolveAccountingPeriod({ period: 'all' }, now), {
    key: 'all', label: 'todo el histórico',
  })
  assert.deepEqual(resolveAccountingPeriod({ period: 'this-month' }, now), {
    key: 'this-month', start: '2026-10-01', end: '2026-11-01', label: 'octubre de 2026',
  })
  assert.deepEqual(resolveAccountingPeriod({ period: 'previous-month' }, now), {
    key: 'previous-month', start: '2026-09-01', end: '2026-10-01', label: 'septiembre de 2026',
  })
  assert.deepEqual(resolveAccountingPeriod({ period: 'this-quarter' }, now), {
    key: 'this-quarter', start: '2026-10-01', end: '2027-01-01', label: '4.º trimestre de 2026',
  })
  assert.deepEqual(resolveAccountingPeriod({ period: 'previous-quarter' }, now), {
    key: 'previous-quarter', start: '2026-07-01', end: '2026-10-01', label: '3.º trimestre de 2026',
  })
  assert.deepEqual(resolveAccountingPeriod({ period: 'this-year' }, now), {
    key: 'this-year', start: '2026-01-01', end: '2027-01-01', label: 'año 2026',
  })
})

test('custom accounting range includes the selected final calendar day', () => {
  assert.deepEqual(resolveAccountingPeriod({ period: 'custom', from: '2026-02-10', to: '2026-02-12' }, now), {
    key: 'custom', start: '2026-02-10', end: '2026-02-13', label: '10 feb 2026 – 12 feb 2026',
  })
})

test('invalid or reversed custom range falls back to the current month', () => {
  for (const input of [
    { period: 'custom', from: 'bad', to: '2026-02-12' },
    { period: 'custom', from: '2026-02-13', to: '2026-02-12' },
  ]) {
    assert.deepEqual(resolveAccountingPeriod(input, now), {
      key: 'this-month', start: '2026-10-01', end: '2026-11-01', label: 'octubre de 2026',
    })
  }
})

test('legacy month links remain valid as an equivalent custom range', () => {
  assert.deepEqual(resolveAccountingPeriod({ month: '2026-07' }, now), {
    key: 'custom', start: '2026-07-01', end: '2026-08-01', label: 'julio de 2026',
  })
})
