import test from 'node:test'
import assert from 'node:assert/strict'
import { canReadResource, validateImage } from '../src/lib/resources/policy.mjs'
import { loadProjectModule, database, clientId, otherClientId } from './helpers/project-harness.mjs'

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

test('each client can only read their own resources; administrator can read all', () => {
 assert.equal(canReadResource(null,'a'),false)
 assert.equal(canReadResource({role:'client',clientId:'a'},'a'),true)
 assert.equal(canReadResource({role:'client',clientId:'a'},'b'),false)
 assert.equal(canReadResource({role:'admin'},'b'),true)
 assert.equal(canReadResource({role:'unknown',clientId:'a'},'a'),false)
})
test('upload validates size and actual image signature, not just declared type',()=>{
 assert.equal(validateImage(Buffer.from([255,216,255,224]),'image/jpeg'),true)
 assert.equal(validateImage(Buffer.from('<svg onload="alert(1)">'),'image/jpeg'),false)
 assert.equal(validateImage(Buffer.from([255,216,255]),'image/png'),false)
 assert.equal(validateImage(Buffer.alloc(10*1024*1024+1),'image/jpeg'),false)
 assert.equal(validateImage(Buffer.alloc(0),'image/jpeg'),false)
})
