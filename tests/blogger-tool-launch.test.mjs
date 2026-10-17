import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  capability,
  client,
  database,
  loadProjectModule,
  project,
} from './helpers/project-harness.mjs'

const migrationUrl = new URL(
  '../supabase/migrations/202610170003_tool_launch_tickets.sql',
  import.meta.url,
)
const launchRoutePath = 'src/app/api/tools/blogger/[siteKey]/launch/route.ts'
const exchangeRoutePath = 'src/app/api/tool-launch/exchange/route.ts'
const protocol = 'wf-blogger-handoff/v1'
const now = Date.parse('2026-10-17T12:00:00.000Z')

const configuredSite = {
  schemaVersion: 1,
  key: 'example',
  name: 'Example',
  domain: 'example.com',
  productionUrl: 'https://example.com',
  panel: { key: 'reports-only', path: '/paneladmin/informes' },
  analytics: { source: 'personal', envSuffix: 'EXAMPLE', legacyDashboard: false },
  blogger: {
    enabled: true,
    url: 'https://example.com/admin/blogger/',
    launchUrl: 'https://example.com/admin/blogger/launch',
    healthUrl: 'https://example.com/api/blogger/health',
    adapter: 'snapshot-build',
    capabilities: ['posts', 'media', 'publish'],
  },
}

function ticketDatabase() {
  let clock = now
  const rows = new Map()
  const calls = []
  return {
    calls,
    rows,
    advance(milliseconds) {
      clock += milliseconds
    },
    async rpc(name, args) {
      calls.push({ name, args: structuredClone(args) })
      if (name === 'create_tool_launch_ticket') {
        if (rows.has(args.p_code_hash)) return { data: null, error: { message: 'duplicate' } }
        const row = {
          protocol: args.p_protocol,
          code_hash: args.p_code_hash,
          site_key: args.p_site_key,
          audience: args.p_audience,
          project_id: args.p_project_id,
          client_id: args.p_client_id,
          user_id: args.p_user_id,
          actor_role: args.p_actor_role,
          created_at: new Date(clock).toISOString(),
          expires_at: new Date(clock + 60_000).toISOString(),
          consumed_at: null,
        }
        rows.set(row.code_hash, row)
        return { data: [{ expires_at: row.expires_at }], error: null }
      }
      if (name === 'consume_tool_launch_ticket') {
        const row = rows.get(args.p_code_hash)
        if (
          !row ||
          row.protocol !== args.p_protocol ||
          row.site_key !== args.p_site_key ||
          row.audience !== args.p_audience ||
          row.consumed_at ||
          Date.parse(row.expires_at) <= clock
        ) {
          return { data: [], error: null }
        }
        row.consumed_at = new Date(clock).toISOString()
        return {
          data: [{
            protocol: row.protocol,
            site_key: row.site_key,
            audience: row.audience,
            project_id: row.project_id,
            client_id: row.client_id,
            user_id: row.user_id,
            actor_role: row.actor_role,
            expires_at: row.expires_at,
          }],
          error: null,
        }
      }
      throw new Error(`Unexpected RPC: ${name}`)
    },
  }
}

function claims(overrides = {}) {
  return {
    siteKey: 'example',
    audience: 'https://example.com',
    projectId: project.id,
    clientId: client.id,
    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    actorRole: 'client',
    ...overrides,
  }
}

function responseSecurity(response) {
  assert.match(response.headers.get('cache-control') ?? '', /no-store/)
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
  assert.match(response.headers.get('content-security-policy') ?? '', /default-src 'none'/)
  assert.match(response.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/)
}

test('migration stores only ticket hashes and atomically consumes a 60-second single-use ticket', async () => {
  const source = await readFile(migrationUrl, 'utf8')

  assert.match(source, /create table (?:if not exists )?public\.tool_launch_tickets/i)
  assert.match(source, /code_hash text primary key/i)
  assert.doesNotMatch(source, /\bcode\s+text\b/i)
  assert.match(source, /now\(\) \+ interval '60 seconds'/i)
  assert.match(source, /update public\.tool_launch_tickets[\s\S]*consumed_at = now\(\)[\s\S]*consumed_at is null[\s\S]*expires_at > now\(\)/i)
  assert.match(source, /site_key = p_site_key[\s\S]*audience = p_audience/i)
  assert.match(source, /returning[\s\S]*project_id[\s\S]*user_id/i)
})

test('migration keeps launch tickets outside browser roles and exposes RPCs only to service_role', async () => {
  const source = await readFile(migrationUrl, 'utf8')

  assert.match(source, /alter table public\.tool_launch_tickets enable row level security/i)
  assert.match(source, /alter table public\.tool_launch_tickets force row level security/i)
  assert.match(source, /revoke all on public\.tool_launch_tickets from public, anon, authenticated/i)
  assert.match(source, /revoke all on function public\.create_tool_launch_ticket[\s\S]*from public, anon, authenticated/i)
  assert.match(source, /revoke all on function public\.consume_tool_launch_ticket[\s\S]*from public, anon, authenticated/i)
  assert.match(source, /grant execute on function public\.create_tool_launch_ticket[\s\S]*to service_role/i)
  assert.match(source, /grant execute on function public\.consume_tool_launch_ticket[\s\S]*to service_role/i)
})

test('createLaunchTicket emits an opaque code but stores only its SHA-256 hash for exactly 60 seconds', async () => {
  const { createLaunchTicket } = await import('../src/lib/tools/launch-tickets.mjs')
  const db = ticketDatabase()
  const entropy = Buffer.alloc(32, 7)
  const ticket = await createLaunchTicket(db, claims(), { randomBytes: () => entropy })

  assert.equal(ticket.protocol, protocol)
  assert.match(ticket.code, /^[A-Za-z0-9_-]{43}$/)
  assert.equal(Date.parse(ticket.expiresAt) - now, 60_000)
  const call = db.calls[0]
  assert.equal(call.name, 'create_tool_launch_ticket')
  assert.equal(call.args.p_code_hash, createHash('sha256').update(ticket.code).digest('hex'))
  assert.equal(JSON.stringify(call).includes(ticket.code), false)
  assert.equal(JSON.stringify([...db.rows.values()]).includes(ticket.code), false)
})

test('consumeLaunchTicket rejects replay, expiry, wrong site and wrong audience without burning a valid ticket', async () => {
  const { createLaunchTicket, consumeLaunchTicket } = await import('../src/lib/tools/launch-tickets.mjs')

  const wrongBindingDb = ticketDatabase()
  const bound = await createLaunchTicket(wrongBindingDb, claims())
  assert.equal(await consumeLaunchTicket(wrongBindingDb, { code: bound.code, ...claims({ siteKey: 'other' }) }), null)
  assert.equal(await consumeLaunchTicket(wrongBindingDb, { code: bound.code, ...claims({ audience: 'https://other.example' }) }), null)
  assert.equal((await consumeLaunchTicket(wrongBindingDb, { code: bound.code, ...claims() })).siteKey, 'example')
  assert.equal(await consumeLaunchTicket(wrongBindingDb, { code: bound.code, ...claims() }), null)

  const expiredDb = ticketDatabase()
  const expired = await createLaunchTicket(expiredDb, claims())
  expiredDb.advance(60_001)
  assert.equal(await consumeLaunchTicket(expiredDb, { code: expired.code, ...claims() }), null)
})

test('concurrent exchanges can consume a ticket only once', async () => {
  const { createLaunchTicket, consumeLaunchTicket } = await import('../src/lib/tools/launch-tickets.mjs')
  const db = ticketDatabase()
  const ticket = await createLaunchTicket(db, claims())

  const results = await Promise.all([
    consumeLaunchTicket(db, { code: ticket.code, ...claims() }),
    consumeLaunchTicket(db, { code: ticket.code, ...claims() }),
  ])
  assert.equal(results.filter(Boolean).length, 1)
})

function launchSetup({ role = 'client', active = true, configured = true } = {}) {
  const activeCapability = {
    ...capability,
    state: active ? 'active' : 'available',
    launch_url: 'https://example.com/admin/blogger/',
    validated_at: active ? project.created_at : null,
  }
  const db = database({
    client_projects: [{ ...project, slug: 'example', domain: 'example.com' }],
    project_capabilities: [activeCapability],
  })
  const created = []
  const mocks = {
    '@/lib/auth': {
      getOptionalIdentity: async () => role ? { userId: claims().userId, email: client.email, role } : null,
      requireClientAccess: async () => ({ userId: claims().userId, email: client.email, role: 'client', client }),
    },
    '@/lib/data/projects': {
      getAccessibleClientProject: async slug => slug === 'example' ? { ...project, slug: 'example', domain: 'example.com' } : null,
      getActiveClientCapability: async () => active ? activeCapability : null,
    },
    '@/lib/sites/registry.mjs': {
      getSiteByKey: key => {
        if (key !== 'example') throw new Error('unknown')
        return configured ? configuredSite : { ...configuredSite, blogger: { enabled: true, url: configuredSite.blogger.url } }
      },
      getBloggerHandoff: site => site.blogger.launchUrl ? site.blogger : null,
    },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => db },
    '@/lib/supabase/admin': { getSupabaseAdminClient: () => ({ serviceRole: true }) },
    '@/lib/tools/launch-tickets.mjs': {
      HANDOFF_PROTOCOL: protocol,
      async createLaunchTicket(_adminDb, input) {
        created.push(input)
        return { protocol, code: 'A'.repeat(43), expiresAt: new Date(now + 60_000).toISOString() }
      },
      renderLaunchForm({ action, code, siteKey }) {
        return `<!doctype html><form method="post" action="${action}"><input name="protocol" value="${protocol}"><input name="code" value="${code}"><input name="siteKey" value="${siteKey}"></form>`
      },
      buildLaunchSecurityHeaders(formAction) {
        return {
          'Cache-Control': 'private, no-store, max-age=0',
          'Referrer-Policy': 'no-referrer',
          'Content-Security-Policy': `default-src 'none'; form-action ${formAction ?? "'none'"}; frame-ancestors 'none'`,
        }
      },
    },
  }
  const route = loadProjectModule(launchRoutePath, mocks)
  const request = (headers = { origin: 'https://studio.example' }) => route.POST(new Request('https://studio.example/api/tools/blogger/example/launch', { method: 'POST', headers }), { params: Promise.resolve({ siteKey: 'example' }) })
  return { created, db, request }
}

test('launch POST authorizes active configured Blogger access for both clients and administrators', async () => {
  for (const role of ['client', 'admin']) {
    const setup = launchSetup({ role })
    const response = await setup.request()
    const html = await response.text()

    assert.equal(response.status, 200, role)
    assert.equal(setup.created.length, 1, role)
    assert.equal(setup.created[0].siteKey, 'example')
    assert.equal(setup.created[0].audience, 'https://example.com')
    assert.equal(setup.created[0].actorRole, role)
    assert.match(html, /method="post"/i)
    assert.match(html, /action="https:\/\/example\.com\/admin\/blogger\/launch"/)
    assert.doesNotMatch(html, /supabase|service.?role|bearer|secret|token/i)
    responseSecurity(response)
    assert.match(response.headers.get('content-security-policy') ?? '', /form-action https:\/\/example\.com(?:;|\s)/)
  }
})

test('launch POST rejects missing or foreign browser origins before creating a ticket', async () => {
  for (const headers of [{}, { origin: 'https://evil.example' }]) {
    const setup = launchSetup()
    const response = await setup.request(headers)
    assert.equal(response.status, 403)
    assert.deepEqual(setup.created, [])
    assert.match(response.headers.get('content-security-policy') ?? '', /form-action 'none'/)
  }
})

test('launch POST fails closed before ticket creation for unauthenticated, inactive and unconfigured access', async () => {
  for (const setup of [
    launchSetup({ role: null }),
    launchSetup({ active: false }),
    launchSetup({ configured: false }),
  ]) {
    const response = await setup.request()
    assert.ok([401, 404].includes(response.status))
    assert.deepEqual(setup.created, [])
    responseSecurity(response)
  }
})

test('exchange POST authenticates the target server and returns only audience-bound session claims', async t => {
  const oldSecret = process.env.WF_BLOGGER_HANDOFF_SECRET_EXAMPLE
  process.env.WF_BLOGGER_HANDOFF_SECRET_EXAMPLE = 'target-shared-secret'
  t.after(() => {
    if (oldSecret === undefined) delete process.env.WF_BLOGGER_HANDOFF_SECRET_EXAMPLE
    else process.env.WF_BLOGGER_HANDOFF_SECRET_EXAMPLE = oldSecret
  })

  const ticketModule = await import('../src/lib/tools/launch-tickets.mjs')
  const consumed = []
  const route = loadProjectModule(exchangeRoutePath, {
    '@/lib/sites/registry.mjs': {
      getSiteByKey: key => key === 'example' ? configuredSite : { ...configuredSite, key: 'other', domain: 'other.example' },
      getBloggerHandoff: site => site.blogger,
    },
    '@/lib/supabase/admin': { getSupabaseAdminClient: () => ({ serviceRole: true }) },
    '@/lib/tools/launch-tickets.mjs': {
      ...ticketModule,
      async consumeLaunchTicket(_db, input) {
        consumed.push(input)
        return {
          protocol,
          siteKey: 'example',
          audience: 'https://example.com',
          projectId: project.id,
          clientId: client.id,
          userId: claims().userId,
          actorRole: 'client',
          expiresAt: new Date(now + 60_000).toISOString(),
        }
      },
    },
  })
  const response = await route.POST(new Request('https://studio.example/api/tool-launch/exchange', {
    method: 'POST',
    headers: { authorization: 'Bearer target-shared-secret', 'content-type': 'application/json' },
    body: JSON.stringify({ protocol, code: 'A'.repeat(43), siteKey: 'example' }),
  }))
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(consumed.length, 1)
  assert.equal(consumed[0].audience, 'https://example.com')
  assert.deepEqual(payload, {
    protocol,
    siteKey: 'example',
    subject: {
      role: 'client',
      userId: claims().userId,
      clientId: client.id,
      projectId: project.id,
    },
  })
  assert.doesNotMatch(JSON.stringify(payload), new RegExp(`${'A'.repeat(43)}|target-shared-secret|expiresAt|\\"code\\"|token`, 'i'))
  responseSecurity(response)
  assert.match(response.headers.get('content-security-policy') ?? '', /form-action 'none'/)
})

async function boundedExchangeSetup() {
  const ticketModule = await import('../src/lib/tools/launch-tickets.mjs')
  const calls = { registry: 0, secret: 0, authorization: 0, database: 0, consume: 0 }
  const route = loadProjectModule(exchangeRoutePath, {
    '@/lib/sites/registry.mjs': {
      getSiteByKey() {
        calls.registry += 1
        return configuredSite
      },
      getBloggerHandoff: site => site.blogger,
    },
    '@/lib/supabase/admin': {
      getSupabaseAdminClient() {
        calls.database += 1
        return { serviceRole: true }
      },
    },
    '@/lib/tools/launch-tickets.mjs': {
      ...ticketModule,
      getBloggerExchangeSecret() {
        calls.secret += 1
        return 'target-secret'
      },
      isBloggerExchangeAuthorized() {
        calls.authorization += 1
        return true
      },
      async consumeLaunchTicket() {
        calls.consume += 1
        return {
          protocol,
          siteKey: 'example',
          audience: 'https://example.com',
          projectId: project.id,
          clientId: client.id,
          userId: claims().userId,
          actorRole: 'client',
          expiresAt: new Date(now + 60_000).toISOString(),
        }
      },
    },
  })
  return { calls, route }
}

function exchangeRequest(body, extraHeaders = {}) {
  return new Request('https://studio.example/api/tool-launch/exchange', {
    method: 'POST',
    headers: {
      authorization: 'Bearer target-secret',
      'content-type': 'application/json',
      ...extraHeaders,
    },
    body,
  })
}

function streamedExchangeRequest(chunks, extraHeaders = {}) {
  const encoder = new TextEncoder()
  let index = 0
  let cancelled = false
  const body = new ReadableStream({
    pull(controller) {
      if (index === chunks.length) {
        controller.close()
        return
      }
      const chunk = chunks[index]
      index += 1
      controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk)
    },
    cancel() {
      cancelled = true
    },
  })
  const request = new Request('https://studio.example/api/tool-launch/exchange', {
    method: 'POST',
    headers: {
      authorization: 'Bearer target-secret',
      'content-type': 'application/json',
      ...extraHeaders,
    },
    body,
    duplex: 'half',
  })
  return { request, wasCancelled: () => cancelled }
}

function validExchangeBody() {
  return JSON.stringify({ protocol, code: 'A'.repeat(43), siteKey: 'example' })
}

function assertNoExchangeBoundaryWork(calls) {
  assert.deepEqual(calls, { registry: 0, secret: 0, authorization: 0, database: 0, consume: 0 })
}

test('exchange accepts a valid JSON body without Content-Length', async () => {
  const setup = await boundedExchangeSetup()
  const request = exchangeRequest(validExchangeBody())
  assert.equal(request.headers.get('content-length'), null)

  const response = await setup.route.POST(request)

  assert.equal(response.status, 200)
  assert.deepEqual(setup.calls, { registry: 1, secret: 1, authorization: 1, database: 1, consume: 1 })
})

test('exchange stops and cancels a chunked stream after it exceeds 4096 bytes', async () => {
  const setup = await boundedExchangeSetup()
  const streamed = streamedExchangeRequest(['x'.repeat(3000), 'y'.repeat(2000), 'unread'])

  const response = await setup.route.POST(streamed.request)

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'invalid_request' })
  assert.equal(streamed.wasCancelled(), true)
  assertNoExchangeBoundaryWork(setup.calls)
})

test('exchange counts actual streamed bytes when Content-Length underreports the body', async () => {
  const setup = await boundedExchangeSetup()
  const streamed = streamedExchangeRequest(['x'.repeat(2048), 'y'.repeat(2049), 'unread'], { 'content-length': '10' })

  const response = await setup.route.POST(streamed.request)

  assert.equal(response.status, 400)
  assert.equal(streamed.wasCancelled(), true)
  assertNoExchangeBoundaryWork(setup.calls)
})

test('exchange rejects and cancels invalid Content-Length values before reading or authenticating', async () => {
  for (const value of ['-1', 'NaN', '4.5', '10, 20']) {
    const setup = await boundedExchangeSetup()
    const streamed = streamedExchangeRequest([validExchangeBody()], { 'content-length': value })

    const response = await setup.route.POST(streamed.request)

    assert.equal(response.status, 400, value)
    assert.equal(streamed.wasCancelled(), true, value)
    assertNoExchangeBoundaryWork(setup.calls)
  }
})

test('exchange enforces the limit in UTF-8 bytes rather than JavaScript characters', async () => {
  const setup = await boundedExchangeSetup()
  const body = JSON.stringify({ padding: 'é'.repeat(2050) })
  assert.ok(body.length < 4096)
  assert.ok(new TextEncoder().encode(body).byteLength > 4096)
  const split = Math.floor(body.length / 2)
  const streamed = streamedExchangeRequest([body.slice(0, split), body.slice(split), 'unread'], { 'content-length': String(body.length) })

  const response = await setup.route.POST(streamed.request)

  assert.equal(response.status, 400)
  assert.equal(streamed.wasCancelled(), true)
  assertNoExchangeBoundaryWork(setup.calls)
})

test('exchange rejects malformed JSON before registry, authentication or database work', async () => {
  const setup = await boundedExchangeSetup()

  const response = await setup.route.POST(exchangeRequest('{"protocol":'))

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'invalid_request' })
  assertNoExchangeBoundaryWork(setup.calls)
})

test('exchange rejects wrong credentials, wrong audience, replay and unavailable tools with safe identical ticket errors', async t => {
  const oldExample = process.env.WF_BLOGGER_HANDOFF_SECRET_EXAMPLE
  const oldOther = process.env.WF_BLOGGER_HANDOFF_SECRET_OTHER
  process.env.WF_BLOGGER_HANDOFF_SECRET_EXAMPLE = 'example-secret'
  process.env.WF_BLOGGER_HANDOFF_SECRET_OTHER = 'other-secret'
  t.after(() => {
    if (oldExample === undefined) delete process.env.WF_BLOGGER_HANDOFF_SECRET_EXAMPLE
    else process.env.WF_BLOGGER_HANDOFF_SECRET_EXAMPLE = oldExample
    if (oldOther === undefined) delete process.env.WF_BLOGGER_HANDOFF_SECRET_OTHER
    else process.env.WF_BLOGGER_HANDOFF_SECRET_OTHER = oldOther
  })

  const ticketModule = await import('../src/lib/tools/launch-tickets.mjs')
  let consumeResult = null
  const route = loadProjectModule(exchangeRoutePath, {
    '@/lib/sites/registry.mjs': {
      getSiteByKey: key => {
        if (key === 'disabled') return { ...configuredSite, key, blogger: { enabled: false } }
        return key === 'example' ? configuredSite : {
          ...configuredSite,
          key: 'other',
          domain: 'other.example',
          blogger: {
            ...configuredSite.blogger,
            launchUrl: 'https://other.example/admin/blogger/launch',
            healthUrl: 'https://other.example/api/blogger/health',
          },
        }
      },
      getBloggerHandoff: site => site.blogger.enabled && site.blogger.launchUrl ? site.blogger : null,
    },
    '@/lib/supabase/admin': { getSupabaseAdminClient: () => ({ serviceRole: true }) },
    '@/lib/tools/launch-tickets.mjs': {
      ...ticketModule,
      async consumeLaunchTicket() { return consumeResult },
    },
  })
  const request = (siteKey, authorization) => route.POST(new Request('https://studio.example/api/tool-launch/exchange', {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify({ protocol, code: 'B'.repeat(43), siteKey }),
  }))

  const wrongCredential = await request('other', 'Bearer example-secret')
  assert.equal(wrongCredential.status, 401)
  assert.deepEqual(await wrongCredential.json(), { error: 'unauthorized' })

  for (const key of ['example', 'other']) {
    const rejected = await request(key, `Bearer ${key}-secret`)
    assert.equal(rejected.status, 401)
    assert.deepEqual(await rejected.json(), { error: 'invalid_or_expired_ticket' })
    responseSecurity(rejected)
  }

  const disabled = await request('disabled', 'Bearer example-secret')
  assert.equal(disabled.status, 404)
  assert.deepEqual(await disabled.json(), { error: 'tool_unavailable' })
})
