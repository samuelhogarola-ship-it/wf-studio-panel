import assert from 'node:assert/strict'
import test from 'node:test'

import { generateDirectBloggerPasswordHash } from '../src/lib/blogger/direct-access.mjs'
import { loadProjectModule } from './helpers/project-harness.mjs'

const routePath = 'src/app/api/blogger/direct-session/route.ts'
const password = 'Sport-Blogger-Only-2026!'
const oldEnv = { ...process.env }

async function configuredRoute() {
  process.env.SPORT_BLOGGER_DIRECT_USERNAME = 'sportmassagefuengirola@gmail.com'
  process.env.SPORT_BLOGGER_DIRECT_PASSWORD_HASH = await generateDirectBloggerPasswordHash(password)
  process.env.SPORT_BLOGGER_DIRECT_SESSION_SECRET = 'session_4Yz!Q9mP2vK7xN5cR8tL3wD6hF1sJ0aB'
  return loadProjectModule(routePath)
}

function formRequest(values, origin = 'https://portal.webfuengirola.com') {
  const body = new URLSearchParams(values)
  return new Request(`${origin}/api/blogger/direct-session`, {
    method: 'POST', body,
    headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
  })
}

test.afterEach(() => {
  process.env = { ...oldEnv }
})

test('correct independent credentials create a secure host-only Blogger session', async () => {
  const { POST } = await configuredRoute()
  const response = await POST(formRequest({ action: 'login', username: 'sportmassagefuengirola@gmail.com', password }))
  assert.equal(response.status, 303)
  assert.equal(response.headers.get('location'), 'https://portal.webfuengirola.com/acceso/blogger/sportmassagefuengirola')
  const cookie = response.headers.get('set-cookie')
  assert.match(cookie, /__Host-wf_blogger=/)
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /Secure/i)
  assert.match(cookie, /SameSite=Strict/i)
  assert.doesNotMatch(cookie, /Domain=/i)
})

test('accepts the public portal host reported by the trusted reverse proxy', async () => {
  const { POST } = await configuredRoute()
  const body = new URLSearchParams({
    action: 'login',
    username: 'sportmassagefuengirola@gmail.com',
    password,
  })
  const response = await POST(new Request('http://wf-studio-panel:3000/api/blogger/direct-session', {
    method: 'POST',
    body,
    headers: {
      origin: 'https://portal.webfuengirola.com',
      'content-type': 'application/x-www-form-urlencoded',
      'x-forwarded-host': 'portal.webfuengirola.com',
      'x-forwarded-proto': 'https',
    },
  }))

  assert.equal(response.status, 303)
  assert.equal(response.headers.get('location'), 'https://portal.webfuengirola.com/acceso/blogger/sportmassagefuengirola')
  assert.match(response.headers.get('set-cookie'), /__Host-wf_blogger=/)
})

test('accepts Coolify internal request URLs when the browser origin is the fixed client portal', async () => {
  const { POST } = await configuredRoute()
  const body = new URLSearchParams({
    action: 'login',
    username: 'sportmassagefuengirola@gmail.com',
    password,
  })
  const response = await POST(new Request('http://wf-studio-panel:3000/api/blogger/direct-session', {
    method: 'POST',
    body,
    headers: {
      origin: 'https://portal.webfuengirola.com',
      'content-type': 'application/x-www-form-urlencoded',
    },
  }))

  assert.equal(response.status, 303)
  assert.equal(response.headers.get('location'), 'https://portal.webfuengirola.com/acceso/blogger/sportmassagefuengirola')
  assert.match(response.headers.get('set-cookie'), /__Host-wf_blogger=/)
})

test('wrong credentials return one generic error and do not create a session', async () => {
  const { POST } = await configuredRoute()
  const response = await POST(formRequest({ action: 'login', username: 'sportmassagefuengirola@gmail.com', password: 'Wrong-Password-2026!' }))
  assert.equal(response.status, 303)
  assert.equal(response.headers.get('location'), 'https://portal.webfuengirola.com/acceso/blogger/sportmassagefuengirola?error=invalid')
  assert.equal(response.headers.get('set-cookie'), null)
})

test('direct Blogger credential endpoint rejects admin host and cross-origin mutation', async () => {
  const { POST } = await configuredRoute()
  assert.equal((await POST(formRequest({ action: 'login', username: 'sportmassagefuengirola@gmail.com', password }, 'https://admin.webfuengirola.com'))).status, 404)
  const crossOrigin = formRequest({ action: 'login', username: 'sportmassagefuengirola@gmail.com', password })
  crossOrigin.headers.set('origin', 'https://evil.example')
  assert.equal((await POST(crossOrigin)).status, 403)
})

test('logout clears only the direct Blogger session and returns to the neutral route', async () => {
  const { POST } = await configuredRoute()
  const response = await POST(formRequest({ action: 'logout' }))
  assert.equal(response.status, 303)
  assert.equal(response.headers.get('location'), 'https://portal.webfuengirola.com/acceso/blogger/sportmassagefuengirola')
  assert.match(response.headers.get('set-cookie'), /__Host-wf_blogger=;/)
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/i)
})

test('login rejects oversized bodies before password verification', async () => {
  let passwordChecks = 0
  const { POST } = loadProjectModule(routePath, {
    '@/lib/blogger/direct-access.mjs': {
      DIRECT_BLOGGER_COOKIE: '__Host-wf_blogger',
      loadDirectBloggerConfig: () => ({ username: 'sportmassagefuengirola@gmail.com', passwordHash: 'unused', sessionSecret: 'unused' }),
      verifyDirectBloggerPassword: async () => { passwordChecks += 1; return false },
      createDirectBloggerSession: () => 'unused',
    },
  })
  const response = await POST(new Request('https://portal.webfuengirola.com/api/blogger/direct-session', {
    method: 'POST',
    body: `action=login&password=${'x'.repeat(5_000)}`,
    headers: { origin: 'https://portal.webfuengirola.com', 'content-type': 'application/x-www-form-urlencoded' },
  }))
  assert.equal(response.status, 413)
  assert.equal(passwordChecks, 0)
})

test('login rate limits repeated password work per proxy-confirmed client', async () => {
  let passwordChecks = 0
  const { POST } = loadProjectModule(routePath, {
    '@/lib/blogger/direct-access.mjs': {
      DIRECT_BLOGGER_COOKIE: '__Host-wf_blogger',
      loadDirectBloggerConfig: () => ({ username: 'sportmassagefuengirola@gmail.com', passwordHash: 'unused', sessionSecret: 'unused' }),
      verifyDirectBloggerPassword: async () => { passwordChecks += 1; return false },
      createDirectBloggerSession: () => 'unused',
    },
  })
  const attempt = () => {
    const request = formRequest({ action: 'login', username: 'sportmassagefuengirola@gmail.com', password: 'wrong' })
    request.headers.set('x-real-ip', '203.0.113.25')
    return POST(request)
  }
  for (let index = 0; index < 10; index += 1) assert.equal((await attempt()).status, 303)
  const blocked = await attempt()
  assert.equal(blocked.status, 429)
  assert.equal(blocked.headers.get('retry-after'), '300')
  assert.equal(passwordChecks, 10)
})
