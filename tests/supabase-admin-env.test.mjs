import assert from 'node:assert/strict'
import test from 'node:test'

import { loadProjectModule } from './helpers/project-harness.mjs'

test('Supabase admin access prefers the explicit legacy service-role fallback when configured', () => {
  const { getSupabaseAdminKey } = loadProjectModule('src/lib/env.ts')

  assert.equal(getSupabaseAdminKey({
    SUPABASE_SERVICE_ROLE_KEY: '  legacy-service-role  ',
    SUPABASE_SECRET_KEY: 'revoked-secret-key',
  }), 'legacy-service-role')
})

test('Supabase admin access keeps the current secret key as the production default', () => {
  const { getSupabaseAdminKey } = loadProjectModule('src/lib/env.ts')

  assert.equal(getSupabaseAdminKey({ SUPABASE_SECRET_KEY: '  current-secret-key  ' }), 'current-secret-key')
  assert.throws(() => getSupabaseAdminKey({}), /SUPABASE_SECRET_KEY/)
})
