import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { validateImage } from '../src/lib/resources/policy.mjs'
import { loadProjectModule, database, client, clientId, otherClientId } from './helpers/project-harness.mjs'

const routePath = 'src/app/api/client-resources/[id]/route.ts'
const ownResourceId = '55555555-5555-4555-8555-555555555555'
const foreignResourceId = '66666666-6666-4666-8666-666666666666'

function routeSetup({ mode, ownStoragePath = `${clientId}/own.png` }) {
 const supportIdentity = { userId: 'support-admin', email: 'support@example.com', role: 'admin' }
 const ordinaryAdmin = { userId: 'ordinary-admin', email: 'admin@example.com', role: 'admin' }
 const clientIdentity = { userId: 'session-client', email: client.email, role: 'client', client }
 const identity = mode === 'client' ? clientIdentity : mode === 'support' ? supportIdentity : ordinaryAdmin
 const viewer = mode === 'support'
  ? { mode: 'support', identity, client, supportSessionId: 'support-session', expiresAt: '2099-10-23T10:15:00.000Z', returnPath: '/paneladmin/inicio' }
  : { mode: 'client', identity: clientIdentity, client }
 const resources = [
  { id: ownResourceId, client_id: clientId, kind: 'photo', title: 'Own', body: '', report_path: null, storage_path: ownStoragePath, content_type: 'image/png', created_by: null, created_at: '2026-10-23T10:00:00Z' },
  { id: foreignResourceId, client_id: otherClientId, kind: 'photo', title: 'Foreign', body: '', report_path: null, storage_path: `${otherClientId}/foreign.png`, content_type: 'image/png', created_by: null, created_at: '2026-10-23T10:00:00Z' },
 ]
 const sessionDb = database({ client_resources: resources })
 const serviceDb = database({ client_resources: resources })
 const storageCalls = []
 for (const db of [sessionDb, serviceDb]) db.storage = { from(bucket) {
  assert.equal(bucket, 'client-resources')
  return { async download(path) {
   storageCalls.push(path)
   return { data: new Blob([path]), error: null }
  } }
 } }
 let serviceRoleCalls = 0
 const route = loadProjectModule(routePath, {
  '@/lib/auth': {
   getOptionalIdentity: async () => identity,
   requireClientAccess: async () => clientIdentity,
  },
  '@/lib/support/portal-viewer': {
   requirePortalViewer: async () => viewer,
   getOptionalSupportViewer: async () => mode === 'support' ? viewer : null,
  },
  '@/lib/supabase/server': { createSupabaseServerClient: async () => sessionDb },
  '@/lib/supabase/admin': { getSupabaseAdminClient() { serviceRoleCalls += 1; return serviceDb } },
 })
 const get = id => route.GET(new Request(`https://studio.example.test/api/client-resources/${id}`), { params: Promise.resolve({ id }) })
 return { get, serviceRoleCalls: () => serviceRoleCalls, storageCalls }
}

test('support can download the selected client resource without service role', async () => {
 const s = routeSetup({ mode: 'support' })
 const response = await s.get(ownResourceId)
 assert.equal(response.status, 200)
 assert.equal(s.serviceRoleCalls(), 0)
 assert.deepEqual(s.storageCalls, [`${clientId}/own.png`])
})

test('support cannot download another client resource by UUID', async () => {
 const s = routeSetup({ mode: 'support' })
 const response = await s.get(foreignResourceId)
 assert.equal(response.status, 404)
 assert.equal(s.serviceRoleCalls(), 0)
 assert.deepEqual(s.storageCalls, [])
})

test('support rejects an owned row whose storage path belongs to another client', async () => {
 const s = routeSetup({ mode: 'support', ownStoragePath: `${otherClientId}/borrowed.png` })
 const response = await s.get(ownResourceId)
 assert.equal(response.status, 404)
 assert.deepEqual(s.storageCalls, [])
})

test('portal downloads reject encoded, traversal, backslash and malformed storage paths', async t => {
 const invalidPaths = [
  `${clientId}/%2e%2e/foreign.png`,
  `${clientId}/../foreign.png`,
  `${clientId}\\foreign.png`,
  `/${clientId}/own.png`,
  `${clientId}//own.png`,
  `${clientId}/`,
 ]
 for (const storagePath of invalidPaths) {
  await t.test(storagePath, async () => {
   const s = routeSetup({ mode: 'support', ownStoragePath: storagePath })
   assert.equal((await s.get(ownResourceId)).status, 404)
   assert.deepEqual(s.storageCalls, [])
  })
 }
})

test('normal client resource downloads preserve own access and cross-client denial', async () => {
 const s = routeSetup({ mode: 'client' })
 assert.equal((await s.get(ownResourceId)).status, 200)
 assert.equal((await s.get(foreignResourceId)).status, 404)
 assert.equal(s.serviceRoleCalls(), 0)
 assert.deepEqual(s.storageCalls, [`${clientId}/own.png`])
})

test('ordinary administrator outside support preserves panel resource access explicitly', async () => {
 const s = routeSetup({ mode: 'admin' })
 assert.equal((await s.get(foreignResourceId)).status, 200)
 assert.equal(s.serviceRoleCalls(), 0)
 assert.deepEqual(s.storageCalls, [`${otherClientId}/foreign.png`])
})

test('ordinary administrator rejects a resource whose row and storage owner disagree', async () => {
 const s = routeSetup({ mode: 'admin', ownStoragePath: `${otherClientId}/borrowed.png` })
 assert.equal((await s.get(ownResourceId)).status, 404)
 assert.deepEqual(s.storageCalls, [])
})

test('private client resource objects have authenticated read policies for session downloads', async () => {
 const migration = await readFile(new URL('../supabase/migrations/202610230003_client_resource_storage_read.sql', import.meta.url), 'utf8')
 assert.match(migration, /create policy client_resource_objects_admin_read on storage\.objects\s+for select to authenticated\s+using \(bucket_id = 'client-resources' and private\.is_admin\(\)\)/i)
 assert.match(migration, /create policy client_resource_objects_own_read on storage\.objects\s+for select to authenticated\s+using \(\s*bucket_id = 'client-resources'\s+and \(storage\.foldername\(name\)\)\[1\] = private\.current_portal_client_id\(\)::text\s*\)/i)
})

test('resource listing uses the authenticated RLS client and keeps the resolved client filter', async () => {
 const owned = { id: 'owned', client_id: clientId, kind: 'report', title: 'Owned', created_at: '2026-10-23T10:00:00Z' }
 const foreign = { ...owned, id: 'foreign', client_id: otherClientId, title: 'Foreign' }
 const db = database({ client_resources: [owned, foreign] })
 const { listResources } = loadProjectModule('src/lib/resources/data.ts', {
  '@/lib/supabase/server': { createSupabaseServerClient: async () => db },
  '@/lib/supabase/admin': { getSupabaseAdminClient() { throw new Error('service role must not read portal resources') } },
 })

 assert.deepEqual(await listResources(clientId), [owned])
})

test('upload validates size and actual image signature, not just declared type',()=>{
 assert.equal(validateImage(Buffer.from([255,216,255,224]),'image/jpeg'),true)
 assert.equal(validateImage(Buffer.from('<svg onload="alert(1)">'),'image/jpeg'),false)
 assert.equal(validateImage(Buffer.from([255,216,255]),'image/png'),false)
 assert.equal(validateImage(Buffer.alloc(10*1024*1024+1),'image/jpeg'),false)
 assert.equal(validateImage(Buffer.alloc(0),'image/jpeg'),false)
})
