import assert from 'node:assert/strict'
import test from 'node:test'

import { loadProjectModule, database, clientId, form } from './helpers/project-harness.mjs'

const client = {
  id: clientId,
  name: 'EPU',
  email: 'epu@example.com',
  status: 'active',
  project: 'wf-studio',
}

test('password generator uses 20 unbiased symbols from the supplied 96+ bit entropy source', async () => {
  const { generateTemporaryPassword } = await import('../src/lib/clients/managed-access.mjs')
  let requestedBytes = 0
  const password = generateTemporaryPassword((size) => {
    requestedBytes = size
    return Buffer.from(Array.from({ length: size }, (_, index) => index))
  })

  assert.ok(requestedBytes >= 12)
  assert.match(password, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{20}$/)
  assert.equal(password, '23456789ABCDEFGHJKLM')
})

test('resolve marks missing access, exact client access, and unsafe records literally', async () => {
  const { resolveManagedAccess } = await import('../src/lib/clients/managed-access.mjs')

  assert.deepEqual(resolveManagedAccess({ client, profile: null }), { status: 'missing' })
  assert.deepEqual(resolveManagedAccess({ client, profile: { id: 'auth-id', email: 'EPU@example.com', role: 'client' } }), {
    status: 'ready', authUserId: 'auth-id',
  })
  assert.deepEqual(resolveManagedAccess({ client: { ...client, status: 'inactive' }, profile: null }), {
    status: 'blocked', reason: 'inactive-client',
  })
  assert.deepEqual(resolveManagedAccess({ client: { ...client, project: 'other' }, profile: null }), {
    status: 'blocked', reason: 'wrong-project',
  })
  for (const project of ['vivir-fuengirola', 'vivir-fuengirola-negocios', 'conoce-fuengirola']) {
    assert.deepEqual(resolveManagedAccess({ client: { ...client, project }, profile: null }), { status: 'missing' })
  }
  assert.deepEqual(resolveManagedAccess({ client, profile: { id: 'admin-id', email: client.email, role: 'admin' } }), {
    status: 'blocked', reason: 'admin-profile',
  })
  assert.deepEqual(resolveManagedAccess({ client, profile: { id: 'auth-id', email: 'changed@example.com', role: 'client' } }), {
    status: 'blocked', reason: 'email-mismatch',
  })
})

function setup({ profiles = [], createError = null } = {}) {
  const db = database({ clients: [client], profiles })
  const authCalls = []
  const adminClient = {
    auth: { admin: {
      async createUser(payload) {
        authCalls.push({ operation: 'create', payload })
        return createError
          ? { data: { user: null }, error: { message: createError } }
          : { data: { user: { id: '55555555-5555-4555-8555-555555555555' } }, error: null }
      },
      async updateUserById(id, payload) {
        authCalls.push({ operation: 'update', id, payload })
        return { data: { user: { id } }, error: null }
      },
    } },
  }
  const actions = loadProjectModule('src/lib/actions/admin.ts', {
    '@/lib/auth': { requireAdmin: async () => ({ userId: 'admin-id' }) },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => db },
    '@/lib/supabase/admin': { getSupabaseAdminClient: () => adminClient },
    '@/lib/email': {},
  })
  return { db, authCalls, actions }
}

test('missing profile creates a confirmed Auth client and returns its password only once', async () => {
  const { db, authCalls, actions } = setup()
  const result = await actions.provisionOrResetClientAccessAction({}, form({ client_id: clientId }))

  assert.equal(result.success, 'Acceso creado correctamente.')
  assert.match(result.generatedPassword, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{20}$/)
  assert.deepEqual(authCalls, [{
    operation: 'create',
    payload: { email: client.email, password: result.generatedPassword, email_confirm: true },
  }])
  assert.equal(db.calls.some((call) => JSON.stringify(call.payload ?? '').includes(result.generatedPassword)), false)
})

test('existing client profile updates that exact Auth user without persisting the password', async () => {
  const profile = { id: '66666666-6666-4666-8666-666666666666', email: client.email, role: 'client' }
  const { db, authCalls, actions } = setup({ profiles: [profile] })
  const result = await actions.provisionOrResetClientAccessAction({}, form({ client_id: clientId }))

  assert.equal(result.success, 'Nueva contraseña generada correctamente.')
  assert.equal(authCalls[0].operation, 'update')
  assert.equal(authCalls[0].id, profile.id)
  assert.equal(authCalls[0].payload.password, result.generatedPassword)
  assert.equal(db.calls.some((call) => JSON.stringify(call.payload ?? '').includes(result.generatedPassword)), false)
})

test('admin profile and a client whose stored Auth email changed are blocked', async () => {
  for (const profile of [
    { id: clientId, email: client.email, role: 'admin' },
    { id: clientId, email: 'changed@example.com', role: 'client' },
  ]) {
    const { authCalls, actions } = setup({ profiles: [profile] })
    const result = await actions.provisionOrResetClientAccessAction({}, form({ client_id: clientId }))
    assert.match(result.error, /seguridad|revisar/i)
    assert.equal(authCalls.length, 0)
  }
})

test('duplicate Auth account fails safely instead of resetting an unverified user', async () => {
  const { authCalls, actions } = setup({ createError: 'User already registered' })
  const result = await actions.provisionOrResetClientAccessAction({}, form({ client_id: clientId }))

  assert.match(result.error, /ya existe.*revisar/i)
  assert.equal(authCalls.length, 1)
  assert.equal(result.generatedPassword, undefined)
})
