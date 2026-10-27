import test from 'node:test'
import assert from 'node:assert/strict'

import { loadProjectModule } from './helpers/project-harness.mjs'

const ADMIN_HOST = 'admin.webfuengirola.com'
const PORTAL_HOST = 'portal.webfuengirola.com'

function request(path, host = ADMIN_HOST) {
  return {
    headers: new Headers({ host }),
    nextUrl: new URL(`https://${host}${path}`),
  }
}

function proxiedRequest(path, forwardedHost, forwardedProto = 'https') {
  return {
    headers: new Headers({
      host: 'wf-studio-panel:3000',
      'x-forwarded-host': forwardedHost,
      'x-forwarded-proto': forwardedProto,
    }),
    nextUrl: new URL(`http://wf-studio-panel:3000${path}`),
  }
}

function contradictoryPublicRequest(path, host, forwardedHost) {
  return {
    headers: new Headers({
      host,
      'x-forwarded-host': forwardedHost,
      'x-forwarded-proto': 'https',
    }),
    nextUrl: new URL(`https://${host}${path}`),
  }
}

function loadMiddleware() {
  const updated = []
  const module = loadProjectModule('middleware.ts', {
    '@/lib/supabase/middleware': {
      async updateSession(currentRequest) {
        updated.push(currentRequest.nextUrl.toString())
        return new Response(null, { status: 204 })
      },
    },
  })
  return { middleware: module.middleware, updated }
}

test('neutral portal host admits the exact direct Blogger entry and existing editor runtime', async () => {
  const { middleware, updated } = loadMiddleware()
  assert.equal((await middleware(request('/acceso/blogger/sportmassagefuengirola', PORTAL_HOST))).status, 204)
  assert.equal((await middleware(request('/blogger/index.html', PORTAL_HOST))).status, 204)
  assert.equal((await middleware(request('/api/posts', PORTAL_HOST))).status, 204)
  assert.deepEqual(updated, [
    `https://${PORTAL_HOST}/acceso/blogger/sportmassagefuengirola`,
    `https://${PORTAL_HOST}/blogger/index.html`,
    `https://${PORTAL_HOST}/api/posts`,
  ])
})

test('admin host is owner-only and rejects all direct-client Blogger entry paths', async () => {
  const { middleware, updated } = loadMiddleware()
  const denied = [
    '/cliente',
    '/cliente?redirectedFrom=%2Facceso%2Fblogger%2Fsportmassagefuengirola',
    '/cliente/registro?redirectedFrom=%2Facceso%2Fblogger%2Fsportmassagefuengirola',
    '/cliente/proyectos?redirectedFrom=%2Facceso%2Fblogger%2Fsportmassagefuengirola',
    '/cliente?redirectedFrom=%2Fpaneladmin%2Finicio',
    '/cliente?redirectedFrom=https%3A%2F%2Fevil.example',
    '/cliente?redirectedFrom=%2Facceso%2Fblogger%2F%2573portmassagefuengirola',
    '/cliente?redirectedFrom=%2Facceso%2Fblogger%2Fsportmassagefuengirola.evil',
    '/auth/callback?next=%2Fcliente%2Fdashboard',
    '/auth/callback?next=%2Facceso%2Fblogger%2Fsportmassagefuengirola',
    '/auth/callback?next=https%3A%2F%2Fevil.example',
    '/auth/callback?next=%2Facceso%2Fblogger%2F%2573portmassagefuengirola',
    '/acceso/blogger/sportmassagefuengirola',
    '/api/blogger/direct-session',
  ]

  for (const path of denied) assert.equal((await middleware(request(path))).status, 404, path)
  assert.equal((await middleware(request('/acceso/blogger/sportmassagefuengirola', `${ADMIN_HOST}:443`))).status, 404)
  assert.deepEqual(updated, [])
})

test('proxy host routing preserves portal access and owner-only admin isolation', async () => {
  const { middleware, updated } = loadMiddleware()
  assert.equal((await middleware(proxiedRequest('/acceso/blogger/sportmassagefuengirola', PORTAL_HOST))).status, 204)
  assert.equal((await middleware(proxiedRequest('/acceso/blogger/sportmassagefuengirola', ADMIN_HOST))).status, 404)
  assert.equal((await middleware(proxiedRequest('/acceso/blogger/sportmassagefuengirola', `${PORTAL_HOST}, ${ADMIN_HOST}`))).status, 404)
  assert.deepEqual(updated, ['http://wf-studio-panel:3000/acceso/blogger/sportmassagefuengirola'])
})

test('proxy headers cannot relabel the public admin host as the client portal', async () => {
  const { middleware, updated } = loadMiddleware()
  const response = await middleware(contradictoryPublicRequest(
    '/acceso/blogger/sportmassagefuengirola',
    ADMIN_HOST,
    PORTAL_HOST,
  ))
  assert.equal(response.status, 404)
  assert.deepEqual(updated, [])
})

test('direct session lookup rejects a valid bearer outside the portal host', async () => {
  let cookieReads = 0
  const module = loadProjectModule('src/lib/blogger/direct-access-server.ts', {
    'next/headers': {
      headers: async () => new Headers({ host: ADMIN_HOST }),
      cookies: async () => ({ get() { cookieReads += 1; return { value: 'valid-token' } } }),
    },
    '@/lib/blogger/direct-access.mjs': {
      DIRECT_BLOGGER_COOKIE: '__Host-wf_blogger',
      loadDirectBloggerConfig: () => ({ sessionSecret: 'secret' }),
      verifyDirectBloggerSession: () => ({ siteKey: 'sportmassagefuengirola' }),
    },
  })
  assert.equal(await module.getDirectBloggerSession(), null)
  assert.equal(cookieReads, 0)
})

test('direct session lookup accepts the strict public portal origin reported by the proxy', async () => {
  let cookieReads = 0
  const expected = { siteKey: 'sportmassagefuengirola', source: 'panel' }
  const module = loadProjectModule('src/lib/blogger/direct-access-server.ts', {
    'next/headers': {
      headers: async () => new Headers({
        host: 'wf-studio-panel:3000',
        'x-forwarded-host': PORTAL_HOST,
        'x-forwarded-proto': 'https',
      }),
      cookies: async () => ({ get() { cookieReads += 1; return { value: 'valid-token' } } }),
    },
    '@/lib/blogger/direct-access.mjs': {
      DIRECT_BLOGGER_COOKIE: '__Host-wf_blogger',
      loadDirectBloggerSessionConfig: () => ({ sessionSecret: 'secret' }),
      verifyDirectBloggerSession: () => expected,
    },
  })
  assert.deepEqual(await module.getDirectBloggerSession(), expected)
  assert.equal(cookieReads, 1)
})

test('direct session lookup rejects ambiguous proxy hosts before reading the bearer', async () => {
  let cookieReads = 0
  const module = loadProjectModule('src/lib/blogger/direct-access-server.ts', {
    'next/headers': {
      headers: async () => new Headers({
        host: 'wf-studio-panel:3000',
        'x-forwarded-host': `${PORTAL_HOST}, ${ADMIN_HOST}`,
        'x-forwarded-proto': 'https',
      }),
      cookies: async () => ({ get() { cookieReads += 1; return { value: 'valid-token' } } }),
    },
  })
  assert.equal(await module.getDirectBloggerSession(), null)
  assert.equal(cookieReads, 0)
})

test('direct session lookup rejects a public admin host mislabeled as portal by forwarded headers', async () => {
  let cookieReads = 0
  const module = loadProjectModule('src/lib/blogger/direct-access-server.ts', {
    'next/headers': {
      headers: async () => new Headers({
        host: ADMIN_HOST,
        'x-forwarded-host': PORTAL_HOST,
        'x-forwarded-proto': 'https',
      }),
      cookies: async () => ({ get() { cookieReads += 1; return { value: 'valid-token' } } }),
    },
    '@/lib/blogger/direct-access.mjs': {
      DIRECT_BLOGGER_COOKIE: '__Host-wf_blogger',
      loadDirectBloggerSessionConfig: () => ({ sessionSecret: 'secret' }),
      verifyDirectBloggerSession: () => ({ siteKey: 'sportmassagefuengirola' }),
    },
  })
  assert.equal(await module.getDirectBloggerSession(), null)
  assert.equal(cookieReads, 0)
})

test('admin auth callback still permits the existing administrator panel destination', async () => {
  const { middleware, updated } = loadMiddleware()
  const response = await middleware(request('/auth/callback?next=%2Fpaneladmin%2Finicio'))

  assert.equal(response.status, 204)
  assert.deepEqual(updated, [`https://${ADMIN_HOST}/auth/callback?next=%2Fpaneladmin%2Finicio`])
})
