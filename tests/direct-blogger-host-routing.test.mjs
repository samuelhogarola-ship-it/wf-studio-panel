import test from 'node:test'
import assert from 'node:assert/strict'

import { loadProjectModule } from './helpers/project-harness.mjs'

const ADMIN_HOST = 'admin.webfuengirola.com'
const PORTAL_HOST = 'portal.webfuengirola.com'

function request(path, host = ADMIN_HOST, cookies = []) {
  return {
    headers: new Headers({ host }),
    nextUrl: new URL(`https://${host}${path}`),
    cookies: {
      get(name) {
        const match = cookies.find(cookie => cookie.name === name)
        return match ? { value: match.value } : undefined
      },
    },
  }
}

function loadMiddleware() {
  const updated = []
  const module = loadProjectModule('middleware.ts', {
    '@/lib/supabase/middleware': {
      async updateSession(currentRequest, options) {
        updated.push({ url: currentRequest.nextUrl.toString(), options })
        return new Response(null, { status: 204 })
      },
    },
  })
  return { middleware: module.middleware, updated }
}

test('admin host rejects direct Blogger pages independently of support routing hints', async () => {
  const { middleware, updated } = loadMiddleware()
  const destination = '%2Facceso%2Fblogger%2Fsportmassagefuengirola'
  const denied = [
    '/acceso/blogger/sportmassagefuengirola',
    '/blogger/index.html',
    '/blogger/editor/index.html?siteKey=sportmassagefuengirola',
  ]
  for (const path of denied) {
    assert.equal((await middleware(request(path, ADMIN_HOST, [{
      name: '__Host-wf_support_preview',
      value: 'forged-client-value',
    }]))).status, 404, path)
  }
  assert.deepEqual(updated, [])
})

test('admin host rejects unsafe callback destinations before session exchange', async () => {
  const { middleware, updated } = loadMiddleware()
  const denied = [
    '/auth/callback?next=%2Fcliente%2Fdashboard',
    '/auth/callback?next=https%3A%2F%2Fevil.example',
    '/auth/callback?next=%2Facceso%2Fblogger%2Fsportmassagefuengirola',
    '/auth/callback?next=%2Facceso%2Fblogger%2F%2573portmassagefuengirola',
  ]

  for (const path of denied) assert.equal((await middleware(request(path))).status, 404, path)
  assert.deepEqual(updated, [])
})

test('admin auth callback still permits the existing administrator panel destination', async () => {
  const { middleware, updated } = loadMiddleware()
  const response = await middleware(request('/auth/callback?next=%2Fpaneladmin%2Finicio'))

  assert.equal(response.status, 204)
  assert.deepEqual(updated, [{
    url: `https://${ADMIN_HOST}/auth/callback?next=%2Fpaneladmin%2Finicio`,
    options: { requiredAuthenticatedRole: 'admin' },
  }])
})

test('admin APIs require an administrator session while portal client routes keep their existing session policy', async () => {
  const { middleware, updated } = loadMiddleware()
  for (const path of [
    '/paneladmin/inicio',
    '/api/blogger/sportmassagefuengirola/posts',
    '/api/posts',
    '/api/build',
  ]) assert.equal((await middleware(request(path))).status, 204)
  assert.equal((await middleware(request('/cliente/dashboard', PORTAL_HOST))).status, 204)

  assert.deepEqual(updated, [
    ...[
      '/paneladmin/inicio',
      '/api/blogger/sportmassagefuengirola/posts',
      '/api/posts',
      '/api/build',
    ].map(path => ({ url: `https://${ADMIN_HOST}${path}`, options: { requiredAuthenticatedRole: 'admin' } })),
    { url: `https://${PORTAL_HOST}/cliente/dashboard`, options: undefined },
  ])
})
