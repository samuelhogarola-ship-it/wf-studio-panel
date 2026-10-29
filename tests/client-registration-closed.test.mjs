import assert from 'node:assert/strict'
import test from 'node:test'

import { loadProjectModule } from './helpers/project-harness.mjs'

test('public client registration action is closed before constructing external dependencies', async () => {
  let dependencyCalls = 0
  const actions = loadProjectModule('src/lib/actions/auth.ts', {
    '@/lib/supabase/server': { createSupabaseServerClient: async () => { dependencyCalls += 1; return {} } },
    '@/lib/supabase/admin': { getSupabaseAdminClient: () => { dependencyCalls += 1; return {} } },
  })

  const result = await actions.clientRegisterAction({}, new FormData())
  assert.deepEqual(result, { error: 'El acceso se crea desde WF Studio. Contacta con el equipo.' })
  assert.equal(dependencyCalls, 0)
})

test('registration page redirects to login with an invite-required message', () => {
  assert.throws(
    () => loadProjectModule('src/app/cliente/registro/page.tsx').default(),
    /redirect:\/cliente\?error=invite_required/,
  )
})

test('client login does not offer a public registration link', async () => {
  const source = await import('node:fs').then(({ readFileSync }) => readFileSync(
    new URL('../src/app/cliente/page.tsx', import.meta.url), 'utf8',
  ))
  assert.doesNotMatch(source, /href=["']\/cliente\/registro/)
})
