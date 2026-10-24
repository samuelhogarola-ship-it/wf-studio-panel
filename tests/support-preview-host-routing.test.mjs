import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

import { loadProjectModule, database, client } from './helpers/project-harness.mjs'

const ADMIN_HOST = 'admin.webfuengirola.com'
const PORTAL_HOST = 'portal.webfuengirola.com'
const COOKIE_NAME = '__Host-wf_support_preview'
const admin = { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'admin@example.com', role: 'admin' }
const token = Buffer.alloc(32, 12).toString('base64url')

function hostRequest(path, host, cookie) {
  return {
    headers: new Headers({ host }),
    nextUrl: new URL(`https://${host}${path}`),
    cookies: {
      get: name => name === COOKIE_NAME && cookie ? { name, value: cookie } : undefined,
      getAll: () => cookie ? [{ name: COOKIE_NAME, value: cookie }] : [],
      set() {},
    },
  }
}

function loadMiddleware() {
  const passed = []
  const module = loadProjectModule('middleware.ts', {
    '@/lib/supabase/middleware': {
      async updateSession(request) {
        passed.push(request.nextUrl.toString())
        return new Response(null, { status: 204 })
      },
    },
  })
  return { middleware: module.middleware, passed }
}

test('production hosts keep support entry, navigation and exit on the admin host without weakening ordinary separation', async () => {
  const { middleware, passed } = loadMiddleware()
  const cases = [
    { name: 'support entry', host: ADMIN_HOST, path: '/cliente/dashboard', cookie: token, status: 204 },
    { name: 'support navigation', host: ADMIN_HOST, path: '/cliente/proyectos/example', cookie: token, status: 204 },
    { name: 'support sign-out endpoint', host: ADMIN_HOST, path: '/auth/sign-out', cookie: token, status: 204 },
    { name: 'support clear endpoint', host: ADMIN_HOST, path: '/api/support-preview/clear', cookie: token, status: 204 },
    { name: 'support return', host: ADMIN_HOST, path: '/paneladmin/proyectos/11111111-1111-4111-8111-111111111111', cookie: undefined, status: 204 },
    { name: 'ordinary admin cannot browse client portal', host: ADMIN_HOST, path: '/cliente/dashboard', cookie: undefined, status: 404 },
    { name: 'ordinary client portal remains available', host: PORTAL_HOST, path: '/cliente/dashboard', cookie: undefined, status: 204 },
    { name: 'portal host still blocks admin pages', host: PORTAL_HOST, path: '/paneladmin/inicio', cookie: undefined, status: 404 },
  ]

  for (const entry of cases) {
    const response = await middleware(hostRequest(entry.path, entry.host, entry.cookie))
    assert.equal(response.status, entry.status, entry.name)
  }

  assert.deepEqual(passed, cases.filter(entry => entry.status === 204).map(entry => `https://${entry.host}${entry.path}`))
})

test('support cookie presence is only a routing hint and forged or stale values fail closed in PortalViewer', async (t) => {
  const previous = process.env.WF_SUPPORT_PREVIEW_ENABLED
  process.env.WF_SUPPORT_PREVIEW_ENABLED = 'true'
  t.after(() => {
    if (previous === undefined) delete process.env.WF_SUPPORT_PREVIEW_ENABLED
    else process.env.WF_SUPPORT_PREVIEW_ENABLED = previous
  })

  const { middleware } = loadMiddleware()
  for (const cookie of ['forged-cookie', token]) {
    assert.equal((await middleware(hostRequest('/cliente/dashboard', ADMIN_HOST, cookie))).status, 204)

    const db = database({
      clients: [client],
      admin_support_sessions: cookie === token ? [{
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        admin_user_id: admin.userId,
        client_id: client.id,
        token_hash: createHash('sha256').update(token).digest('hex'),
        return_path: '/paneladmin/inicio',
        started_at: '2099-10-23T10:00:00.000Z',
        expires_at: '2099-10-23T10:30:00.000Z',
        ended_at: '2099-10-23T10:05:00.000Z',
        end_reason: 'manual',
      }] : [],
    })
    const viewer = loadProjectModule('src/lib/support/portal-viewer.ts', {
      '@/lib/auth': {
        getOptionalIdentity: async () => admin,
        requireClientAccess: async () => { throw new Error('client access must not authorize support') },
      },
      '@/lib/supabase/server': { createSupabaseServerClient: async () => db },
      'next/headers': { cookies: async () => ({ get: () => ({ value: cookie }) }) },
      'next/navigation': { redirect(url) { throw new Error(`redirect:${url}`) } },
    })

    await assert.rejects(
      () => viewer.requirePortalViewer(),
      { message: 'redirect:/api/support-preview/clear' },
      cookie,
    )
  }
})
