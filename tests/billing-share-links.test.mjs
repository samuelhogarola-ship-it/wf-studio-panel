import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { boundary, database, form, loadProjectModule } from './helpers/project-harness.mjs'

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8')
}

test('share tokens are random and only their SHA-256 digest is persisted', async () => {
  const share = loadProjectModule('src/lib/billing/share-token.ts')
  const first = share.createBillingShareToken()
  const second = share.createBillingShareToken()
  assert.notEqual(first.rawToken, second.rawToken)
  assert.equal(first.rawToken.length, 64)
  assert.equal(first.tokenHash.length, 64)
  assert.equal(share.hashBillingShareToken(first.rawToken), first.tokenHash)
  assert.equal(first.rawToken.includes(first.tokenHash), false)
})

test('admin creates exactly seven-day shares and database receives only the digest', async () => {
  const db = database({}, {}, { rpcs: {
    create_billing_share: ({ args }) => ({ data: { id: 'share-1', expires_at: args.p_expires_at }, error: null }),
  } })
  const actions = loadProjectModule('src/lib/actions/billing-shares.ts', boundary(db).mocks)
  const result = await actions.createBillingShareAction({}, form({ document_id: '11111111-1111-4111-8111-111111111111' }))
  assert.match(result.shareUrl, /^\/d\/[a-f0-9]{64}$/)
  const args = db.calls.find(call => call.table === 'rpc:create_billing_share')?.args
  assert.equal(args.p_token_hash.length, 64)
  assert.equal(result.shareUrl.includes(args.p_token_hash), false)
  const lifetime = new Date(args.p_expires_at).getTime() - Date.now()
  assert.ok(lifetime > 6.99 * 24 * 60 * 60 * 1000 && lifetime <= 7 * 24 * 60 * 60 * 1000)
})

test('share schema closes revoked, expired and paid documents with one-document scope', async () => {
  const sql = await source('supabase/migrations/202610270003_internal_billing_workspace.sql')
  assert.match(sql, /create table public\.billing_share_links/i)
  assert.match(sql, /token_hash text not null unique/i)
  assert.match(sql, /expires_at[\s\S]*interval '7 days'/i)
  assert.match(sql, /create or replace function public\.resolve_billing_share/i)
  assert.match(sql, /s\.revoked_at is null/i)
  assert.match(sql, /s\.expires_at > now\(\)/i)
  assert.match(sql, /d\.status = 'issued'/i)
  assert.match(sql, /where s\.token_hash = p_token_hash/i)
  assert.match(sql, /billing_documents_client_read[\s\S]*status in \('issued', 'paid'\)/i)
  assert.doesNotMatch(sql, /'document',\s*to_jsonb\(d\)/i)
  assert.doesNotMatch(sql, /jsonb_agg\(to_jsonb\([lp]\)/i)
  assert.match(sql, /p\.document_id = d\.id[\s\S]*p\.advance_invoice_id = d\.id/i)
  assert.match(sql, /'url',\s*o\.url/i)
  assert.doesNotMatch(sql, /o\.payment_url/i)
})

test('share revocation failure is surfaced before revalidation', async () => {
  const db = database({}, {}, { rpcs: {
    revoke_billing_share: () => ({ data: null, error: { message: 'database failure' } }),
  } })
  const cacheCalls = []
  const actions = loadProjectModule('src/lib/actions/billing-shares.ts', {
    ...boundary(db).mocks,
    'next/cache': { revalidatePath: path => cacheCalls.push(path) },
  })
  await assert.rejects(
    actions.revokeBillingShareAction(form({ share_id: '11111111-1111-4111-8111-111111111111' })),
    /enlace/i,
  )
  assert.deepEqual(cacheCalls, [])
})

test('missing share revocation is surfaced before revalidation', async () => {
  const db = database({}, {}, { rpcs: { revoke_billing_share: () => ({ data: false, error: null }) } })
  const cacheCalls = []
  const actions = loadProjectModule('src/lib/actions/billing-shares.ts', {
    ...boundary(db).mocks,
    'next/cache': { revalidatePath: path => cacheCalls.push(path) },
  })
  await assert.rejects(actions.revokeBillingShareAction(form({ share_id: '11111111-1111-4111-8111-111111111111' })), /enlace/i)
  assert.deepEqual(cacheCalls, [])
})

test('public share and registered-client pages show document balance and active payment option', async () => {
  const [publicPage, facturas, pagos, data] = await Promise.all([
    source('src/app/d/[token]/page.tsx'),
    source('src/app/cliente/(protected)/facturas/page.tsx'),
    source('src/app/cliente/(protected)/pagos/page.tsx'),
    source('src/lib/data/billing-shares.ts'),
  ])
  assert.match(publicPage, /getSharedBillingDocument/)
  assert.match(publicPage, /Saldo pendiente|Pendiente/)
  assert.match(publicPage, /paymentOption|payment_option/)
  assert.match(data, /hashBillingShareToken/)
  assert.match(facturas, /getClientBillingDocuments/)
  assert.match(pagos, /getClientBillingDocuments/)
})
