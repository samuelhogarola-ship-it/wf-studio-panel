import test from 'node:test'
import assert from 'node:assert/strict'

test('internal billing database behavior can run against the support database', { skip: !process.env.WF_SUPPORT_TEST_DATABASE_URL }, async () => {
  assert.ok(process.env.WF_SUPPORT_TEST_DATABASE_URL)
})
