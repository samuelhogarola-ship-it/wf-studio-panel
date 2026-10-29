import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { boundary, database, loadProjectModule } from './helpers/project-harness.mjs'

const requestA = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  platform: 'vivir-fuengirola',
  request_type: 'client',
  name: 'Ada',
  email: 'ada@example.com',
  phone: '',
  company: '',
  profile_data: { language: 'es' },
  message: '',
  source_url: 'https://vivirenfuengirola.com/alta',
  status: 'pending',
  converted_client_id: null,
  reviewed_at: null,
  rejection_reason: null,
  created_at: '2026-10-29T10:00:00Z',
}
const requestB = {
  ...requestA,
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  platform: 'vivir-fuengirola-negocios',
  request_type: 'business',
  name: 'Bodega Sol',
  email: 'hola@bodegasol.example',
  created_at: '2026-10-29T11:00:00Z',
}
const requestC = {
  ...requestA,
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  platform: 'conoce-fuengirola',
  name: 'Conoce Guest',
  email: 'guest@example.com',
  created_at: '2026-10-29T12:00:00Z',
}

test('Supabase types expose platform request rows and exact workflow RPC results', async () => {
  const source = await readFile(new URL('../src/lib/supabase/types.ts', import.meta.url), 'utf8')
  assert.match(source, /export type PlatformRequestPlatform = 'vivir-fuengirola' \| 'vivir-fuengirola-negocios' \| 'conoce-fuengirola'/)
  assert.match(source, /platform_requests: \{[\s\S]*?profile_data: Json[\s\S]*?status: PlatformRequestStatus/)
  assert.match(source, /approve_platform_request: \{ Args: \{ p_request_id: string \}; Returns: \{ outcome: 'created_client' \| 'existing_client'; client_id: string \}\[\] \}/)
  assert.match(source, /reject_platform_request: \{ Args: \{ p_request_id: string; p_reason: string \| null \}; Returns: boolean \}/)
})

test('inbox authenticates first, filters platforms and keeps newest requests first', async () => {
  const db = database({ platform_requests: [requestA, requestB, requestC] })
  const auth = boundary(db)
  const { getPlatformRequestInbox } = loadProjectModule('src/lib/platform-requests/admin.ts', auth.mocks)

  const result = await getPlatformRequestInbox({
    platforms: ['vivir-fuengirola', 'vivir-fuengirola-negocios'],
    status: 'pending',
  })

  assert.deepEqual(auth.events.slice(0, 2), ['admin', 'session-db'])
  assert.deepEqual(result.requests.map((item) => item.id), [requestB.id, requestA.id])
  assert.equal(result.requests.some((item) => item.id === requestC.id), false)
  assert.equal(db.calls[0].columns, 'id,platform,request_type,name,email,phone,company,profile_data,message,source_url,status,converted_client_id,reviewed_at,rejection_reason,created_at')
})

test('inbox search is normalized and a foreign selected request never leaks into detail', async () => {
  const db = database({ platform_requests: [requestA, requestB, requestC] })
  const auth = boundary(db)
  const { getPlatformRequestInbox } = loadProjectModule('src/lib/platform-requests/admin.ts', auth.mocks)

  const result = await getPlatformRequestInbox({
    platforms: ['vivir-fuengirola'],
    status: 'pending',
    query: ' ADA@EXAMPLE ',
    selectedId: requestC.id,
  })

  assert.deepEqual(result.requests.map((item) => item.id), [requestA.id])
  assert.equal(result.selectedRequest, null)
})

test('pending counts are returned independently for all three platform namespaces', async () => {
  const db = database({ platform_requests: [requestA, requestB, requestC, { ...requestC, id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', status: 'approved' }] })
  const auth = boundary(db)
  const { getPendingPlatformRequestCounts } = loadProjectModule('src/lib/platform-requests/admin.ts', auth.mocks)

  assert.deepEqual(await getPendingPlatformRequestCounts(), {
    'vivir-fuengirola': 1,
    'vivir-fuengirola-negocios': 1,
    'conoce-fuengirola': 1,
  })
  assert.equal(auth.events[0], 'admin')
})

function actionSetup({ request = requestA, approveOutcome = 'created_client', rpcFailure } = {}) {
  const clientId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  const db = database({ platform_requests: [request] }, {}, {
    rpcs: {
      approve_platform_request: () => rpcFailure
        ? { data: null, error: { message: rpcFailure } }
        : { data: [{ outcome: approveOutcome, client_id: clientId }], error: null },
      reject_platform_request: () => ({ data: true, error: null }),
    },
  })
  const revalidated = []
  const auth = boundary(db, { 'next/cache': { revalidatePath: (path) => revalidated.push(path) } })
  const actions = loadProjectModule('src/lib/actions/platform-requests.ts', auth.mocks)
  return { actions, auth, db, revalidated, clientId }
}

test('approve validates the request id before database work', async () => {
  const { actions, db, auth } = actionSetup()
  const formData = new FormData()
  formData.set('request_id', 'not-a-uuid')
  const result = await actions.approvePlatformRequestAction({}, formData)
  assert.equal(auth.events[0], 'admin')
  assert.equal(result.error, 'La solicitud no es válida.')
  assert.equal(db.calls.length, 0)
})

for (const [outcome, message] of [
  ['created_client', 'Solicitud aprobada y cliente creado.'],
  ['existing_client', 'Solicitud aprobada y enlazada al cliente existente.'],
]) {
  test(`approve maps ${outcome} and revalidates paths derived from the stored platform`, async () => {
    const { actions, db, revalidated, clientId } = actionSetup({ request: requestB, approveOutcome: outcome })
    const formData = new FormData()
    formData.set('request_id', requestB.id)
    formData.set('platform', 'conoce-fuengirola')
    const result = await actions.approvePlatformRequestAction({}, formData)

    assert.equal(result.success, message)
    assert.equal(result.clientId, clientId)
    assert.equal(result.clientHref, `/paneladmin/clientes/${clientId}`)
    assert.ok(db.calls.some((call) => call.table === 'rpc:approve_platform_request' && call.args.p_request_id === requestB.id))
    assert.deepEqual(new Set(revalidated), new Set([
      '/paneladmin/inicio',
      '/paneladmin/vivir-en-fuengirola/solicitudes',
      '/paneladmin/vivir-en-fuengirola/negocios',
      `/paneladmin/clientes/${clientId}`,
    ]))
    assert.equal(revalidated.includes('/paneladmin/conoce-fuengirola/solicitudes'), false)
  })
}

test('approve translates an already resolved database result without leaking its message', async () => {
  const { actions } = actionSetup({ rpcFailure: 'Platform request is already resolved: internal detail' })
  const formData = new FormData()
  formData.set('request_id', requestA.id)
  const result = await actions.approvePlatformRequestAction({}, formData)
  assert.equal(result.error, 'La solicitud ya fue resuelta.')
  assert.doesNotMatch(JSON.stringify(result), /internal detail/)
})

test('reject validates the reason, audits through RPC and revalidates only the stored platform inbox', async () => {
  const { actions, db, revalidated } = actionSetup({ request: requestC })
  const invalid = new FormData()
  invalid.set('request_id', requestC.id)
  invalid.set('reason', 'x'.repeat(501))
  assert.equal((await actions.rejectPlatformRequestAction({}, invalid)).error, 'El motivo no puede superar 500 caracteres.')
  assert.equal(db.calls.some((call) => call.table === 'rpc:reject_platform_request'), false)

  const valid = new FormData()
  valid.set('request_id', requestC.id)
  valid.set('reason', 'Ficha incompleta')
  const result = await actions.rejectPlatformRequestAction({}, valid)
  assert.equal(result.success, 'Solicitud rechazada.')
  assert.ok(db.calls.some((call) => call.table === 'rpc:reject_platform_request' && call.args.p_reason === 'Ficha incompleta'))
  assert.deepEqual(new Set(revalidated), new Set([
    '/paneladmin/inicio',
    '/paneladmin/conoce-fuengirola/solicitudes',
    '/paneladmin/conoce-fuengirola/clientes',
  ]))
})
