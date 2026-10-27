import test from 'node:test'
import assert from 'node:assert/strict'

import { loadProjectModule } from './helpers/project-harness.mjs'

test('date inputs use the Madrid calendar day across the UTC midnight boundary', () => {
  const { madridDateInputValue } = loadProjectModule('src/lib/billing/date.ts')
  assert.equal(madridDateInputValue(new Date('2026-10-26T23:30:00Z')), '2026-10-27')
  assert.equal(madridDateInputValue(new Date('2026-01-15T22:30:00Z')), '2026-01-15')
})
