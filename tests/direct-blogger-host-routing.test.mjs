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
  assert.deepEqual(updated, [])
})

test('admin auth callback still permits the existing administrator panel destination', async () => {
  const { middleware, updated } = loadMiddleware()
  const response = await middleware(request('/auth/callback?next=%2Fpaneladmin%2Finicio'))

  assert.equal(response.status, 204)
  assert.deepEqual(updated, [`https://${ADMIN_HOST}/auth/callback?next=%2Fpaneladmin%2Finicio`])
})
