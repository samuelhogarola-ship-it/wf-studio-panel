import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

import { loadProjectModule, database, client } from './helpers/project-harness.mjs'

const admin = { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'admin@example.com', role: 'admin' }
const clientIdentity = { userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: client.email, role: 'client', client }
const token = Buffer.alloc(32, 7).toString('base64url')
const tokenHash = createHash('sha256').update(token).digest('hex')
const now = '2026-10-23T10:00:00.000Z'
const returnPath = '/paneladmin/clientes/22222222-2222-4222-8222-222222222222'

function supportRow(overrides = {}) {
  return {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    admin_user_id: admin.userId,
    client_id: client.id,
    token_hash: tokenHash,
    return_path: returnPath,
    started_at: '2099-10-23T09:45:00.000Z',
    expires_at: '2099-10-23T10:15:00.000Z',
    ended_at: null,
    end_reason: null,
    ...overrides,
  }
}

function setup({
  identity = clientIdentity,
  cookie = token,
  enabled = true,
  sessions = [supportRow()],
  clients = [client],
} = {}) {
  const previousFlag = process.env.WF_SUPPORT_PREVIEW_ENABLED
  process.env.WF_SUPPORT_PREVIEW_ENABLED = enabled ? 'true' : 'false'
  const db = database({ admin_support_sessions: sessions, clients }, {}, { rpcs: {
    end_admin_support_session({ args, tables }) {
      const row = tables.admin_support_sessions.find(candidate => candidate.token_hash === args.p_token_hash && candidate.ended_at === null)
      if (!row) return { data: false, error: null }
      row.ended_at = now
      row.end_reason = args.p_reason
      return { data: true, error: null }
    },
  } })
  const redirects = []
  const mocks = {
    '@/lib/auth': {
      getOptionalIdentity: async () => identity,
      requireClientAccess: async () => {
        if (identity?.role !== 'client') throw new Error('ordinary client guard must not authorize support')
        return clientIdentity
      },
      requireAdmin: async () => {
        if (identity?.role !== 'admin') throw new Error('redirect:/paneladmin')
        return identity
      },
    },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => db },
    'next/headers': { cookies: async () => ({ get: name => name === '__Host-wf_support_preview' && cookie ? { value: cookie } : undefined }) },
    'next/navigation': { redirect(url) { redirects.push(url); throw new Error(`redirect:${url}`) } },
  }
  const load = relative => loadProjectModule(relative, mocks)
  const restore = () => {
    if (previousFlag === undefined) delete process.env.WF_SUPPORT_PREVIEW_ENABLED
    else process.env.WF_SUPPORT_PREVIEW_ENABLED = previousFlag
  }
  return { db, redirects, load, restore }
}

test('real clients keep ordinary access and ignore a support cookie', async (t) => {
  const s = setup({ sessions: [supportRow({ admin_user_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' })] })
  t.after(s.restore)

  const viewer = await s.load('src/lib/support/portal-viewer.ts').requirePortalViewer()

  assert.equal(viewer.mode, 'client')
  assert.equal(viewer.client.id, client.id)
  assert.equal(s.db.calls.some(call => call.table === 'admin_support_sessions'), false)
})

test('a valid administrator support session resolves the selected client without exposing its token', async (t) => {
  const s = setup({ identity: admin })
  t.after(s.restore)

  const viewer = await s.load('src/lib/support/portal-viewer.ts').requirePortalViewer()

  assert.deepEqual(viewer, {
    mode: 'support',
    identity: admin,
    client,
    supportSessionId: supportRow().id,
    expiresAt: supportRow().expires_at,
    returnPath,
  })
  assert.doesNotMatch(JSON.stringify(viewer), new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('an administrator without a support cookie remains outside the client portal', async (t) => {
  const s = setup({ identity: admin, cookie: null })
  t.after(s.restore)

  await assert.rejects(
    () => s.load('src/lib/support/portal-viewer.ts').requirePortalViewer(),
    { message: 'redirect:/paneladmin/inicio' },
  )
})

test('wrong-admin and malformed support cookies fail through the clearing route without leaking the token', async (t) => {
  for (const cookie of [token, 'not-a-support-token']) {
    const s = setup({ identity: admin, cookie, sessions: [supportRow({ admin_user_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' })] })
    t.after(s.restore)
    await assert.rejects(
      () => s.load('src/lib/support/portal-viewer.ts').requirePortalViewer(),
      error => error.message === 'redirect:/api/support-preview/clear' && !error.message.includes(cookie),
    )
  }
})

test('expiry and client inactivity persist their exact end reason before fail-closed clearing', async (t) => {
  const cases = [
    { sessions: [supportRow({ started_at: '2020-01-01T00:00:00.000Z', expires_at: '2020-01-01T00:30:00.000Z' })], clients: [client], reason: 'expired' },
    { sessions: [supportRow()], clients: [{ ...client, status: 'inactive' }], reason: 'client_inactive' },
  ]
  for (const entry of cases) {
    const s = setup({ identity: admin, sessions: entry.sessions, clients: entry.clients })
    t.after(s.restore)
    await assert.rejects(
      () => s.load('src/lib/support/portal-viewer.ts').requirePortalViewer(),
      { message: 'redirect:/api/support-preview/clear' },
    )
    assert.equal(s.db.tables.admin_support_sessions[0].end_reason, entry.reason)
  }
})

test('the feature flag is checked on every admin request and fails closed', async (t) => {
  const s = setup({ identity: admin, enabled: false })
  t.after(s.restore)

  await assert.rejects(
    () => s.load('src/lib/support/portal-viewer.ts').requirePortalViewer(),
    { message: 'redirect:/api/support-preview/clear' },
  )
  assert.equal(s.db.calls.some(call => call.table === 'clients'), false)
})

test('optional support resolution distinguishes an ordinary admin from an admin carrying invalid support state', async (t) => {
  const ordinary = setup({ identity: admin, cookie: null, enabled: false })
  t.after(ordinary.restore)
  assert.equal(await ordinary.load('src/lib/support/portal-viewer.ts').getOptionalSupportViewer(), null)

  const stale = setup({ identity: admin, enabled: false })
  t.after(stale.restore)
  await assert.rejects(
    () => stale.load('src/lib/support/portal-viewer.ts').getOptionalSupportViewer(),
    { message: 'redirect:/api/support-preview/clear' },
  )
})

test('client mutation access preserves real clients and rejects support viewers', async (t) => {
  const ordinary = setup()
  t.after(ordinary.restore)
  const clientViewer = await ordinary.load('src/lib/support/portal-viewer.ts').requireClientMutationAccess()
  assert.equal(clientViewer.mode, 'client')
  assert.equal(clientViewer.client.id, client.id)

  const support = setup({ identity: admin })
  t.after(support.restore)
  await assert.rejects(
    () => support.load('src/lib/support/portal-viewer.ts').requireClientMutationAccess(),
    error => error?.name === 'SupportReadOnlyError'
      && error.code === 'support_readonly'
      && error.status === 403
      && error.message === 'No disponible en modo soporte.',
  )
})

test('return-path normalization accepts only approved admin paths and query keys', async (t) => {
  const s = setup()
  t.after(s.restore)
  const { normalizeSupportReturnPath } = s.load('src/lib/support/portal-viewer.ts')

  for (const value of [
    '/paneladmin/inicio',
    '/paneladmin/clientes/22222222-2222-4222-8222-222222222222',
    '/paneladmin/proyectos/11111111-1111-4111-8111-111111111111?supportPreview=expired',
  ]) assert.equal(normalizeSupportReturnPath(value), value)

  for (const value of [
    '//evil.test/paneladmin/inicio',
    '/paneladmin/%2f%2fevil.test',
    '/paneladmin/%5cevil',
    '/paneladmin/\\evil',
    '/paneladmin/inicio#fragment',
    '/paneladmin/inicio?next=%2F%2Fevil.test',
    '/paneladmin/inicio?supportPreview=expired&extra=1',
    '/paneladmin/../cliente',
  ]) assert.equal(normalizeSupportReturnPath(value), '/paneladmin/inicio', value)
})

test('the clear route derives the saved return path server-side, ends active sessions, clears the cookie and never loops', async (t) => {
  const s = setup({ identity: admin })
  t.after(s.restore)
  const cookieWrites = []
  const route = loadProjectModule('src/app/api/support-preview/clear/route.ts', {
    ...{
      '@/lib/auth': { requireAdmin: async () => admin },
      '@/lib/supabase/server': { createSupabaseServerClient: async () => s.db },
      'next/headers': { cookies: async () => ({ get: () => ({ value: token }) }) },
      'next/server': { NextResponse: { redirect(url) { return { location: url.toString(), cookies: { set(value) { cookieWrites.push(value) } } } } } },
    },
  })

  const response = await route.GET(new Request('https://studio.example.test/api/support-preview/clear?reason=expired&returnPath=https://evil.test'))

  assert.equal(s.db.tables.admin_support_sessions[0].end_reason, 'access_revoked')
  assert.equal(response.location, `https://studio.example.test${returnPath}?supportPreview=access_revoked`)
  assert.deepEqual(cookieWrites, [{ name: '__Host-wf_support_preview', value: '', httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 }])
  assert.doesNotMatch(response.location, /support-preview\/clear|evil/)
  assert.equal(response.location.includes(token), false)
})

test('the clear route preserves an already recorded expiry reason and defaults unsafe return paths', async (t) => {
  const expired = supportRow({ ended_at: now, end_reason: 'expired', return_path: '//evil.test' })
  const s = setup({ identity: admin, sessions: [expired] })
  t.after(s.restore)
  const route = loadProjectModule('src/app/api/support-preview/clear/route.ts', {
    '@/lib/auth': { requireAdmin: async () => admin },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => s.db },
    'next/headers': { cookies: async () => ({ get: () => ({ value: token }) }) },
    'next/server': { NextResponse: { redirect(url) { return { location: url.toString(), cookies: { set() {} } } } } },
  })

  const response = await route.GET(new Request('https://studio.example.test/api/support-preview/clear?reason=access_revoked'))

  assert.equal(response.location, 'https://studio.example.test/paneladmin/inicio?supportPreview=expired')
  assert.equal(s.db.tables.admin_support_sessions[0].end_reason, 'expired')
})

test('POST clear safely ends stale support state with a 303 and preserves the exact reason', async (t) => {
  const expired = supportRow({
    started_at: '2020-01-01T00:00:00.000Z',
    expires_at: '2020-01-01T00:30:00.000Z',
  })
  const s = setup({ identity: admin, sessions: [expired] })
  t.after(s.restore)
  const cookieWrites = []
  const route = loadProjectModule('src/app/api/support-preview/clear/route.ts', {
    '@/lib/auth': { requireAdmin: async () => admin },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => s.db },
    'next/headers': { cookies: async () => ({ get: () => ({ value: token }) }) },
    'next/server': { NextResponse: { redirect(url, status) { return { location: url.toString(), status, cookies: { set(value) { cookieWrites.push(value) } } } } } },
  })

  const response = await route.POST(new Request('https://admin.webfuengirola.com/api/support-preview/clear', { method: 'POST' }))

  assert.equal(response.status, 303)
  assert.equal(response.location, `https://admin.webfuengirola.com${returnPath}?supportPreview=expired`)
  assert.equal(s.db.tables.admin_support_sessions[0].end_reason, 'expired')
  assert.equal(cookieWrites[0].name, '__Host-wf_support_preview')
  assert.equal(cookieWrites[0].maxAge, 0)
})
