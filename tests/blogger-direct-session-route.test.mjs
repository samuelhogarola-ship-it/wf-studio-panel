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
  assert.match(cookie, /__Host-wf_sport_blogger=/)
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /Secure/i)
  assert.match(cookie, /SameSite=Strict/i)
  assert.doesNotMatch(cookie, /Domain=/i)
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
  assert.match(response.headers.get('set-cookie'), /__Host-wf_sport_blogger=;/)
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/i)
})
