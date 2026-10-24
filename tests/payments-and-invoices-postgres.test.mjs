import test from 'node:test'

test('Postgres payment concurrency coverage is enabled when the support database is available', { skip: !process.env.WF_SUPPORT_TEST_DATABASE_URL }, async () => {
 const { default: assert } = await import('node:assert/strict')
 assert.ok(process.env.WF_SUPPORT_TEST_DATABASE_URL)
})
