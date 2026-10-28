import assert from 'node:assert/strict'
import test from 'node:test'

import { loadProjectModule } from './helpers/project-harness.mjs'

const routePath = 'src/app/api/blogger/handoff/route.ts'
const origin = 'https://blogger.sportmassagefuengirola.com'
const siteKey = 'sportmassagefuengirola'
const code = 'H'.repeat(43)
const binding = {
  protocol: 'wf-blogger-handoff/v1',
  siteKey,
  audience: origin,
  projectId: '11111111-1111-4111-8111-111111111111',
  clientId: '22222222-2222-4222-8222-222222222222',
  userId: 'sport-user',
  actorRole: 'client',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
}

function loadRoute(consumeResult) {
  const calls = []
  const route = loadProjectModule(routePath, {
    '@/lib/supabase/admin': { getSupabaseAdminClient: () => ({ marker: 'database' }) },
    '@/lib/tools/launch-tickets.mjs': {
      buildLaunchSecurityHeaders: () => ({
        'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
        'Referrer-Policy': 'no-referrer',
      }),
      async consumeLaunchTicket(database, input) {
        calls.push({ database, input })
        return consumeResult(calls.length)
      },
    },
    '@/lib/blogger/direct-access.mjs': {
      DIRECT_BLOGGER_COOKIE: '__Host-wf_blogger',
      loadDirectBloggerSessionConfig: () => ({ sessionSecret: 'session_Aa1!2345678901234567890', siteKey }),
      createDirectBloggerSession: input => {
        assert.deepEqual(input.subject, {
          userId: binding.userId,
          clientId: binding.clientId,
          projectId: binding.projectId,
        })
        return 'custom-host-session'
      },
    },
  })
  return { route, calls }
}

test('custom host consumes its exact ticket and redirects to a clean root session', async () => {
  const { route, calls } = loadRoute(() => binding)
  const response = await route.GET(new Request(`${origin}/api/blogger/handoff?code=${code}`))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('location'), null)
  assert.deepEqual(calls, [{
    database: { marker: 'database' },
    input: { code, siteKey, audience: origin },
  }])
  const cookie = response.headers.get('set-cookie') ?? ''
  assert.match(cookie, /__Host-wf_blogger=custom-host-session/)
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /Secure/i)
  assert.match(cookie, /SameSite=Strict/i)
  assert.doesNotMatch(cookie, /Domain=/i)
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0, must-revalidate')
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
  const html = await response.text()
  assert.match(html, /Opening WF-Blogger/)
  assert.match(html, /Continue to WF-Blogger/)
  assert.match(html, /history\.replaceState\([^)]*['"]\/['"]\)/)
  assert.match(html, /location\.replace\(['"]\/['"]\)/)
  assert.doesNotMatch(html, new RegExp(code))
})

test('handoff accepts the exact custom Host when Coolify omits forwarded headers', async () => {
  const { route, calls } = loadRoute(() => binding)
  const response = await route.GET(new Request(`http://wf-studio-panel:3000/api/blogger/handoff?code=${code}`, {
    headers: { host: 'blogger.sportmassagefuengirola.com' },
  }))
  assert.equal(response.status, 200)
  assert.match(response.headers.get('set-cookie') ?? '', /__Host-wf_blogger=custom-host-session/)
  assert.deepEqual(calls, [{ database: { marker: 'database' }, input: { code, siteKey, audience: origin } }])
})

test('custom host rejects replay and binding mismatches without creating a session', async () => {
  for (const consumed of [
    null,
    { ...binding, audience: 'https://portal.webfuengirola.com' },
    { ...binding, siteKey: 'personaltrainerfuengirola' },
    { ...binding, actorRole: 'admin' },
    { ...binding, clientId: null },
  ]) {
    const { route } = loadRoute(() => consumed)
    const response = await route.GET(new Request(`${origin}/api/blogger/handoff?code=${code}`))
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('location'), `${origin}/?error=handoff`)
    assert.equal(response.headers.get('set-cookie'), null)
    assert.doesNotMatch(`${response.headers.get('location')} ${await response.text()}`, new RegExp(code))
  }

  const { route } = loadRoute(call => call === 1 ? binding : null)
  assert.match((await route.GET(new Request(`${origin}/api/blogger/handoff?code=${code}`))).headers.get('set-cookie') ?? '', /custom-host-session/)
  assert.equal((await route.GET(new Request(`${origin}/api/blogger/handoff?code=${code}`))).headers.get('set-cookie'), null)
})

test('handoff rejects wrong hosts, malformed codes and extra query input before ticket consumption', async () => {
  const { route, calls } = loadRoute(() => binding)
  assert.equal((await route.GET(new Request(`https://portal.webfuengirola.com/api/blogger/handoff?code=${code}`))).status, 404)
  for (const url of [`${origin}/api/blogger/handoff?code=short`, `${origin}/api/blogger/handoff?code=${code}&siteKey=another-tenant`]) {
    const response = await route.GET(new Request(url))
    assert.equal(response.status, 303, url)
    assert.equal(response.headers.get('location'), `${origin}/?error=handoff`)
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
  }
  assert.deepEqual(calls, [])
})

test('handoff rejects contradictory public proxy hosts before consuming a ticket', async () => {
  for (const forwardedHost of [
    'portal.webfuengirola.com',
    'blogger.sportmassagefuengirola.com, portal.webfuengirola.com',
  ]) {
    const { route, calls } = loadRoute(() => binding)
    const response = await route.GET(new Request(`${origin}/api/blogger/handoff?code=${code}`, {
      headers: { 'x-forwarded-host': forwardedHost, 'x-forwarded-proto': 'https' },
    }))
    assert.equal(response.status, 404)
    assert.deepEqual(calls, [])
  }
})
