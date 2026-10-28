import test from 'node:test'
import assert from 'node:assert/strict'

import { createClientWithPassword } from '../src/lib/clients/direct-create.mjs'

function setup(overrides = {}) {
  const calls = { auth: [], clients: [], deleted: [] }
  const dependencies = {
    createAuthUser: async (input) => {
      calls.auth.push(input)
      return { userId: 'auth-user-1', error: null }
    },
    insertClient: async (input) => {
      calls.clients.push(input)
      return { error: null }
    },
    deleteAuthUser: async (userId) => {
      calls.deleted.push(userId)
    },
    ...overrides,
  }
  return { calls, dependencies }
}

test('direct client creation normalizes email and creates matching auth and client records', async () => {
  const { calls, dependencies } = setup()

  const result = await createClientWithPassword({
    name: 'Cliente Demo',
    email: ' Demo@Example.COM ',
    password: 'temporary-secret',
    project: 'vivir-fuengirola-negocios',
    ...dependencies,
  })

  assert.deepEqual(calls.auth, [{ email: 'demo@example.com', password: 'temporary-secret' }])
  assert.deepEqual(calls.clients, [{
    id: 'auth-user-1',
    name: 'Cliente Demo',
    email: 'demo@example.com',
    status: 'active',
    project: 'vivir-fuengirola-negocios',
  }])
  assert.deepEqual(calls.deleted, [])
  assert.equal(result.success, 'Cliente Cliente Demo creado correctamente. Ya puede acceder con su contraseña.')
})

test('direct client creation translates duplicate auth accounts without inserting a client', async () => {
  const { calls, dependencies } = setup({
    createAuthUser: async () => ({ userId: null, error: { message: 'User already registered' } }),
  })

  const result = await createClientWithPassword({
    name: 'Cliente Demo', email: 'demo@example.com', password: 'temporary-secret', project: 'wf-studio', ...dependencies,
  })

  assert.equal(result.error, 'Ya existe una cuenta con ese email.')
  assert.deepEqual(calls.clients, [])
})

test('direct client creation does not expose unexpected auth errors', async () => {
  const { dependencies } = setup({
    createAuthUser: async () => ({ userId: null, error: { message: 'internal service key detail' } }),
  })

  const result = await createClientWithPassword({
    name: 'Cliente Demo', email: 'demo@example.com', password: 'temporary-secret', project: 'wf-studio', ...dependencies,
  })

  assert.equal(result.error, 'No se pudo crear el acceso del cliente.')
})

test('direct client creation removes the auth user when the client insert fails', async () => {
  const { calls, dependencies } = setup({
    insertClient: async () => ({ error: { message: 'duplicate key value violates clients_project_email_lower_unique_idx' } }),
  })

  const result = await createClientWithPassword({
    name: 'Cliente Demo', email: 'demo@example.com', password: 'temporary-secret', project: 'wf-studio', ...dependencies,
  })

  assert.deepEqual(calls.deleted, ['auth-user-1'])
  assert.equal(result.error, 'Ya existe un cliente con ese email en este espacio.')
})

test('direct client creation preserves the primary error when auth cleanup fails', async () => {
  const { dependencies } = setup({
    insertClient: async () => ({ error: { message: 'database unavailable' } }),
    deleteAuthUser: async () => { throw new Error('cleanup unavailable') },
  })

  const result = await createClientWithPassword({
    name: 'Cliente Demo', email: 'demo@example.com', password: 'temporary-secret', project: 'wf-studio', ...dependencies,
  })

  assert.equal(result.error, 'No se pudo crear el cliente.')
})
