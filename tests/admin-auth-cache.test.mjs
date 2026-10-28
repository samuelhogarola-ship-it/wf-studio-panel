import test from 'node:test'
import assert from 'node:assert/strict'

import { loadProjectModule } from './helpers/project-harness.mjs'

function requestAuthModule() {
  const counts = { users: 0, profiles: 0 }
  const supabase = {
    auth: { async getUser() { counts.users += 1; return { data: { user: { id: 'admin-1', email: 'admin@example.com' } } } } },
    from(table) {
      assert.equal(table, 'profiles')
      const query = {
        select() { return query }, eq() { return query },
        async maybeSingle() { counts.profiles += 1; return { data: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } } },
      }
      return query
    },
  }
  const memoizingCache = (fn) => {
    let called = false
    let result
    return (...args) => {
      if (!called) {
        called = true
        result = fn(...args)
      }
      return result
    }
  }
  const auth = loadProjectModule('src/lib/auth.ts', {
    react: { cache: memoizingCache },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => supabase },
  })
  return { auth, counts }
}

test('requireAdmin reuses one identity lookup inside a render request', async () => {
  const firstRequest = requestAuthModule()
  const [first, second] = await Promise.all([firstRequest.auth.requireAdmin(), firstRequest.auth.requireAdmin()])
  assert.deepEqual(first, second)
  assert.deepEqual(firstRequest.counts, { users: 1, profiles: 1 })

  const nextRequest = requestAuthModule()
  await nextRequest.auth.requireAdmin()
  assert.deepEqual(nextRequest.counts, { users: 1, profiles: 1 })
})
