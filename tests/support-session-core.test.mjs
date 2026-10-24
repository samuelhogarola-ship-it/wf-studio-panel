import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { loadProjectModule, database, client } from './helpers/project-harness.mjs'

const now = new Date('2026-10-23T10:00:00.000Z')
const adminUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const token = Buffer.alloc(32, 7).toString('base64url')
const hash = createHash('sha256').update(token).digest('hex')
const row = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', admin_user_id: adminUserId, client_id: client.id, token_hash: hash, return_path: '/paneladmin/clientes/22222222-2222-4222-8222-222222222222', started_at: now.toISOString(), expires_at: '2026-10-23T10:30:00.000Z', ended_at: null, end_reason: null }
const options = { now: () => now, randomBytes: size => { assert.equal(size, 32); return Buffer.alloc(size, 7) } }
function support() {
  assert.ok(existsSync(new URL('../src/lib/support/support-session.ts', import.meta.url)), 'support-session implementation must exist')
  return loadProjectModule('src/lib/support/support-session.ts')
}
function dbFixture(session = row, seed = {}) {
  const db = database({ admin_support_sessions: session ? [session] : [], ...seed })
  const rpcCalls = []
  db.rpc = async (name, args) => {
    rpcCalls.push({ name, args })
    return { data: name === 'start_admin_support_session' ? [row] : true, error: null }
  }
  return { db, rpcCalls }
}
const createInput = { adminUserId, clientId: client.id, returnPath: row.return_path }
const resolveInput = { adminUserId, token }

test('create generates 32 random bytes, persists only SHA-256, and returns safe context', async () => {
  const { db, rpcCalls } = dbFixture()
  const result = await support().createSupportSession(db, createInput, options)
  assert.equal(result.token, token)
  assert.deepEqual(result.session, { id: row.id, adminUserId, clientId: client.id, returnPath: row.return_path, startedAt: row.started_at, expiresAt: row.expires_at })
  assert.deepEqual(rpcCalls, [{ name: 'start_admin_support_session', args: { p_client_id: client.id, p_token_hash: hash, p_return_path: row.return_path } }])
  assert.equal(JSON.stringify(result.session).includes(token), false)
})

test('default randomness emits distinct opaque canonical tokens', async () => {
  const { db } = dbFixture()
  const values = await Promise.all(Array.from({ length: 8 }, () => support().createSupportSession(db, createInput)))
  assert.equal(new Set(values.map(value => value.token)).size, 8)
  for (const value of values) assert.match(value.token, /^[A-Za-z0-9_-]{43}$/)
})

test('cookie flags and lifetime are exact and clearing retains the host boundary', () => {
  const { supportCookie, clearSupportCookie } = support()
  assert.deepEqual(supportCookie(token, 1800), { name: '__Host-wf_support_preview', value: token, httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 1800 })
  assert.equal(supportCookie(token, 9000).maxAge, 1800)
  assert.equal(supportCookie(token, -1).maxAge, 0)
  assert.equal(supportCookie(token, 1.9).maxAge, 1)
  assert.equal(supportCookie(token, NaN).maxAge, 0)
  assert.deepEqual(clearSupportCookie(), { name: '__Host-wf_support_preview', value: '', httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
  assert.throws(() => supportCookie('bad; injection', 1800), /invalid support token/i)
})

test('create rejects unapproved return paths before database writes', async () => {
  const { db, rpcCalls } = dbFixture()
  for (const returnPath of ['https://evil.test', '//evil.test', '/cliente/dashboard', '/paneladmin', '/paneladmin/../cliente', '/paneladmin/%2e%2e/cliente', '/paneladmin/\\evil', '/paneladmin/inicio?next=evil', '/paneladmin/inicio#evil', '/paneladmin/inicio\n']) {
    await assert.rejects(support().createSupportSession(db, { ...createInput, returnPath }, options), /return path/i)
  }
  assert.equal(rpcCalls.length, 0)
  for (const returnPath of ['/paneladmin/inicio', '/paneladmin/proyectos/11111111-1111-4111-8111-111111111111']) {
    await support().createSupportSession(db, { ...createInput, returnPath }, options)
  }
})

test('create rejects inactive, unknown and non-Studio clients before starting', async () => {
  for (const clients of [[], [{ ...client, status: 'inactive' }], [{ ...client, project: 'other' }]]) {
    const { db, rpcCalls } = dbFixture(row, { clients })
    await assert.rejects(support().createSupportSession(db, createInput, options), /active client required/i)
    assert.equal(rpcCalls.length, 0)
  }
})

test('resolution hashes tokens and binds lookup to the real administrator', async () => {
  const { db } = dbFixture()
  assert.equal((await support().resolveSupportSession(db, resolveInput, options)).id, row.id)
  assert.equal(await support().resolveSupportSession(db, { ...resolveInput, adminUserId: 'other-admin' }, options), null)
  assert.equal(await support().resolveSupportSession(db, { ...resolveInput, token: Buffer.alloc(32, 8).toString('base64url') }, options), null)
  assert.equal(db.calls.filter(call => call.table === 'admin_support_sessions').length, 3)
})

test('invalid, missing and ended sessions fail closed without writes', async () => {
  const { db, rpcCalls } = dbFixture({ ...row, ended_at: now.toISOString(), end_reason: 'replaced' })
  for (const invalid of [null, '', 'invalid', `${token}=`, 'x'.repeat(100)]) assert.equal(await support().resolveSupportSession(db, { ...resolveInput, token: invalid }, options), null)
  assert.equal(await support().resolveSupportSession(db, resolveInput, options), null)
  assert.equal(await support().resolveSupportSession(dbFixture(null).db, resolveInput, options), null)
  assert.equal(rpcCalls.length, 0)
})

test('expiry at the exact boundary ends the session as expired', async () => {
  const { db, rpcCalls } = dbFixture()
  assert.equal(await support().resolveSupportSession(db, resolveInput, { now: () => new Date(row.expires_at) }), null)
  assert.deepEqual(rpcCalls, [{ name: 'end_admin_support_session', args: { p_token_hash: hash, p_reason: 'expired' } }])
})

test('deactivated or removed clients revoke resolution and record client_inactive', async () => {
  for (const clients of [[], [{ ...client, status: 'inactive' }], [{ ...client, project: 'other' }]]) {
    const { db, rpcCalls } = dbFixture(row, { clients })
    assert.equal(await support().resolveSupportSession(db, resolveInput, options), null)
    assert.equal(rpcCalls[0].args.p_reason, 'client_inactive')
  }
})

test('end hashes the token and never sends an administrator ID to the RPC', async () => {
  const { db, rpcCalls } = dbFixture()
  assert.equal(await support().endSupportSession(db, resolveInput, 'manual'), true)
  assert.deepEqual(rpcCalls, [{ name: 'end_admin_support_session', args: { p_token_hash: hash, p_reason: 'manual' } }])
  assert.equal(await support().endSupportSession(db, { ...resolveInput, token: null }, 'manual'), false)
  await assert.rejects(support().endSupportSession(db, resolveInput, 'bogus'), /end reason/i)
})

test('database failures expose only safe errors and resolution fails closed', async () => {
  const { db } = dbFixture()
  db.rpc = async () => ({ data: null, error: { message: 'secret token and upstream detail' } })
  await assert.rejects(support().createSupportSession(db, createInput, options), { message: 'Unable to start support session' })
  await assert.rejects(support().endSupportSession(db, resolveInput, 'manual'), { message: 'Unable to end support session' })
  const broken = database({}, { admin_support_sessions: 'secret upstream detail' })
  assert.equal(await support().resolveSupportSession(broken, resolveInput, options), null)
})
