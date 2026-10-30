import assert from 'node:assert/strict'
import test from 'node:test'

import {
  handlePlatformRequestConfigGet,
  handlePlatformRequestOptions,
  handlePlatformRequestPost,
  persistPlatformRequest,
} from '../src/lib/platform-requests/public-api.mjs'

const validPayload = {
  platform: 'vivir-fuengirola',
  requestType: 'client',
  name: 'Ada Lovelace',
  email: ' ADA@Example.COM ',
  phone: '+34 600 000 000',
  company: 'Analytical Engines',
  message: 'Quiero registrar mi ficha.',
  profile: { sector: 'technology' },
  sourceUrl: 'https://vivirenfuengirola.com/registro',
  website: '',
  token: '',
}

const validBusinessProfile = {
  schema_version: 'fichero.v1',
  catalog: 'fuengirola',
  canonicalSlug: 'bodega-sol',
  displayName: 'Bodega Sol',
  cif: 'B-12.345.678',
  contactEmail: 'hola@bodegasol.example',
  categoryKey: 'restaurantes',
  categoryLabel: 'Restaurantes',
  shortDescription: 'Bodega local en Fuengirola.',
  plan: 'pro',
}

const validBusinessPayload = {
  ...validPayload,
  platform: 'vivir-fuengirola-negocios',
  requestType: 'business',
  name: 'Bodega Sol',
  email: 'hola@bodegasol.example',
  profile: validBusinessProfile,
}

function request(method, body, origin = 'https://vivirenfuengirola.com') {
  const resolvedBody = body === undefined && method === 'POST' ? validPayload : body
  return new Request('https://admin.webfuengirola.com/api/platform-requests', {
    method,
    headers: { origin, 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.8' },
    ...(resolvedBody === undefined ? {} : { body: JSON.stringify(resolvedBody) }),
  })
}

function acceptingOptions(overrides = {}) {
  return {
    env: { NODE_ENV: 'development' },
    createRequest: async () => 'created',
    ...overrides,
  }
}

test('OPTIONS allows only the four exact production origins without wildcard CORS', async () => {
  for (const origin of [
    'https://vivirenfuengirola.com',
    'https://www.vivirenfuengirola.com',
    'https://conocefuengirola.com',
    'https://www.conocefuengirola.com',
  ]) {
    const response = await handlePlatformRequestOptions(request('OPTIONS', undefined, origin), { env: { NODE_ENV: 'production' } })
    assert.equal(response.status, 204)
    assert.equal(response.headers.get('access-control-allow-origin'), origin)
    assert.notEqual(response.headers.get('access-control-allow-origin'), '*')
  }

  const forbidden = await handlePlatformRequestOptions(request('OPTIONS', undefined, 'https://evil.example'), { env: { NODE_ENV: 'production' } })
  assert.equal(forbidden.status, 403)
  assert.equal(forbidden.headers.get('access-control-allow-origin'), null)
})

test('development accepts only its one configured local origin and production ignores it', async () => {
  const origin = 'http://localhost:4321'
  const enabled = await handlePlatformRequestOptions(request('OPTIONS', undefined, origin), {
    env: { NODE_ENV: 'development', PLATFORM_REQUEST_DEV_ORIGIN: origin },
  })
  assert.equal(enabled.status, 204)

  const disabled = await handlePlatformRequestOptions(request('OPTIONS', undefined, origin), {
    env: { NODE_ENV: 'production', PLATFORM_REQUEST_DEV_ORIGIN: origin },
  })
  assert.equal(disabled.status, 403)
})

test('origin-to-platform mapping rejects cross-platform submissions and forged source URLs', async () => {
  const crossPlatform = await handlePlatformRequestPost(request('POST', {
    ...validPayload,
    platform: 'conoce-fuengirola',
  }), acceptingOptions())
  assert.equal(crossPlatform.status, 403)
  assert.deepEqual(await crossPlatform.json(), { success: false, error: 'platform_not_allowed' })

  const forgedSource = await handlePlatformRequestPost(request('POST', {
    ...validPayload,
    sourceUrl: 'https://evil.example/registro',
  }), acceptingOptions())
  assert.equal(forgedSource.status, 400)
  assert.deepEqual(await forgedSource.json(), { success: false, error: 'invalid_payload' })

  const conoceBusiness = await handlePlatformRequestPost(request('POST', {
    ...validPayload,
    platform: 'conoce-fuengirola',
    requestType: 'business',
    profile: validBusinessProfile,
    sourceUrl: 'https://conocefuengirola.com/alta',
  }, 'https://conocefuengirola.com'), acceptingOptions())
  assert.equal(conoceBusiness.status, 201)
})

test('valid payload is normalized and fingerprinted before persistence', async () => {
  const received = []
  const response = await handlePlatformRequestPost(request('POST'), acceptingOptions({
    createRequest: async (payload) => { received.push(payload); return 'created' },
  }))
  assert.equal(response.status, 201)
  assert.equal(received.length, 1)
  assert.deepEqual(received[0], {
    platform: 'vivir-fuengirola',
    request_type: 'client',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '+34 600 000 000',
    company: 'Analytical Engines',
    message: 'Quiero registrar mi ficha.',
    profile_data: { sector: 'technology' },
    source_url: 'https://vivirenfuengirola.com/registro',
    fingerprint: '6c2ce602dc572c06475ca442cd3dec407172c0df5ea78197dc67db8b2a115128',
  })
})

test('both Fuengirola sources accept the same strict fichero.v1 business contract', async () => {
  const received = []
  const options = acceptingOptions({ createRequest: async (payload) => { received.push(payload); return 'created' } })
  const vivir = await handlePlatformRequestPost(request('POST', validBusinessPayload), options)
  const conoce = await handlePlatformRequestPost(request('POST', {
    ...validBusinessPayload,
    platform: 'conoce-fuengirola',
    sourceUrl: 'https://conocefuengirola.com/publica-tu-negocio',
  }, 'https://conocefuengirola.com'), options)

  assert.equal(vivir.status, 201)
  assert.equal(conoce.status, 201)
  assert.equal(received[0].profile_data.schema_version, 'fichero.v1')
  assert.equal(received[0].profile_data.catalog, 'fuengirola')
  assert.equal(received[0].profile_data.profile.plan, 'pro')
  assert.equal(received[0].profile_data.profile.cif, 'B12345678')
  assert.equal(received[1].profile_data.profile.displayName, 'Bodega Sol')
})

test('business intake rejects unknown profile fields, unsupported versions and invalid plans before writing', async () => {
  let writes = 0
  const options = acceptingOptions({ createRequest: async () => { writes += 1; return 'created' } })
  for (const profile of [
    { ...validBusinessProfile, ownerUserId: 'attacker-controlled' },
    { ...validBusinessProfile, schema_version: 'fichero.v2' },
    { ...validBusinessProfile, catalog: 'otro-catalogo' },
    { ...validBusinessProfile, plan: 'normal' },
  ]) {
    const response = await handlePlatformRequestPost(request('POST', { ...validBusinessPayload, profile }), options)
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { success: false, error: 'invalid_payload' })
  }
  assert.equal(writes, 0)
})

test('business duplicate fingerprints span both source platforms by normalized CIF', async () => {
  const received = []
  const options = acceptingOptions({ createRequest: async (payload) => { received.push(payload); return 'created' } })
  await handlePlatformRequestPost(request('POST', validBusinessPayload), options)
  await handlePlatformRequestPost(request('POST', {
    ...validBusinessPayload,
    platform: 'conoce-fuengirola',
    sourceUrl: 'https://conocefuengirola.com/publica-tu-negocio',
    profile: { ...validBusinessProfile, cif: ' b 12345678 ' },
  }, 'https://conocefuengirola.com'), options)

  assert.equal(received.length, 2)
  assert.equal(received[0].fingerprint, received[1].fingerprint)
})

test('business duplicate fingerprints fall back to normalized email domain and name when CIF is absent', async () => {
  const received = []
  const options = acceptingOptions({ createRequest: async (payload) => { received.push(payload); return 'created' } })
  const profile = { ...validBusinessProfile, cif: '' }
  await handlePlatformRequestPost(request('POST', { ...validBusinessPayload, profile }), options)
  await handlePlatformRequestPost(request('POST', {
    ...validBusinessPayload,
    platform: 'conoce-fuengirola',
    name: '  BODEGA SOL ',
    email: ' HOLA@BODEGASOL.EXAMPLE ',
    sourceUrl: 'https://conocefuengirola.com/publica-tu-negocio',
    profile: { ...profile, displayName: 'Bódega   Sol' },
  }, 'https://conocefuengirola.com'), options)

  assert.equal(received[0].fingerprint, received[1].fingerprint)
})

test('required fields, enum values and common string limits fail before persistence', async () => {
  let writes = 0
  const options = acceptingOptions({ createRequest: async () => { writes += 1; return 'created' } })
  for (const patch of [
    { email: '' },
    { name: '' },
    { requestType: 'unknown' },
    { name: 'x'.repeat(121) },
    { email: `${'x'.repeat(150)}@example.com` },
    { phone: 'x'.repeat(81) },
    { company: 'x'.repeat(161) },
    { message: 'x'.repeat(5001) },
    { sourceUrl: `https://vivirenfuengirola.com/${'x'.repeat(500)}` },
  ]) {
    const response = await handlePlatformRequestPost(request('POST', { ...validPayload, ...patch }), options)
    assert.equal(response.status, 400, JSON.stringify(patch))
    assert.equal((await response.json()).error, 'invalid_payload')
  }
  assert.equal(writes, 0)
})

test('profile must be a bounded object and the whole body is capped at 32 KiB', async () => {
  const tooDeep = { a: { b: { c: { d: { e: { f: 'too deep' } } } } } }
  const tooManyKeys = Object.fromEntries(Array.from({ length: 101 }, (_, index) => [`key${index}`, index]))
  const oversizedProfile = { text: 'x'.repeat(24_576) }
  for (const profile of [[], tooDeep, tooManyKeys, oversizedProfile]) {
    const response = await handlePlatformRequestPost(request('POST', { ...validPayload, profile }), acceptingOptions())
    assert.equal(response.status, 400)
    assert.equal((await response.json()).error, 'invalid_payload')
  }

  const oversizedBody = request('POST', { ...validPayload, message: 'x'.repeat(33_000) })
  const response = await handlePlatformRequestPost(oversizedBody, acceptingOptions())
  assert.equal(response.status, 400)
  assert.equal((await response.json()).error, 'invalid_payload')
})

test('oversized streaming bodies stop reading and cancel at the 32 KiB boundary', async () => {
  let pulls = 0
  let cancelled = false
  const body = new ReadableStream({
    pull(controller) {
      pulls += 1
      controller.enqueue(new TextEncoder().encode('x'.repeat(20_000)))
      if (pulls >= 10) controller.close()
    },
    cancel() { cancelled = true },
  })
  const streamingRequest = new Request('https://admin.webfuengirola.com/api/platform-requests', {
    method: 'POST',
    headers: { origin: 'https://vivirenfuengirola.com', 'content-type': 'application/json' },
    body,
    duplex: 'half',
  })
  const response = await handlePlatformRequestPost(streamingRequest, acceptingOptions())
  assert.equal(response.status, 400)
  assert.equal((await response.json()).error, 'invalid_payload')
  assert.ok(pulls < 10)
  assert.equal(cancelled, true)
})

test('honeypot mimics a successful creation without writing', async () => {
  let writes = 0
  const response = await handlePlatformRequestPost(request('POST', { ...validPayload, website: 'spam' }), acceptingOptions({
    createRequest: async () => { writes += 1; return 'created' },
  }))
  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), { success: true, outcome: 'created' })
  assert.equal(writes, 0)
})

test('Turnstile is optional only outside production and partial configuration fails closed', async () => {
  const development = await handlePlatformRequestPost(request('POST'), acceptingOptions())
  assert.equal(development.status, 201)

  for (const env of [
    { NODE_ENV: 'production' },
    { NODE_ENV: 'production', NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'public-only' },
    { NODE_ENV: 'production', TURNSTILE_SECRET_KEY: 'private-only' },
  ]) {
    const response = await handlePlatformRequestPost(request('POST'), acceptingOptions({ env }))
    assert.equal(response.status, 503)
    const body = await response.json()
    assert.deepEqual(body, { success: false, error: 'requests_not_configured' })
    assert.doesNotMatch(JSON.stringify(body), /public-only|private-only/)
  }
})

test('Turnstile token and verified hostname must match the allowed request origin', async () => {
  const env = {
    NODE_ENV: 'production',
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'public-key',
    TURNSTILE_SECRET_KEY: 'private-secret',
  }
  const missing = await handlePlatformRequestPost(request('POST'), acceptingOptions({ env }))
  assert.equal(missing.status, 400)

  const accepted = await handlePlatformRequestPost(request('POST', { ...validPayload, token: 'valid-token' }), acceptingOptions({
    env,
    verifyToken: async (token, ip, secret) => {
      assert.deepEqual({ token, ip, secret }, { token: 'valid-token', ip: '203.0.113.8', secret: 'private-secret' })
      return { success: true, hostname: 'vivirenfuengirola.com' }
    },
  }))
  assert.equal(accepted.status, 201)

  const wrongHost = await handlePlatformRequestPost(request('POST', { ...validPayload, token: 'valid-token' }), acceptingOptions({
    env,
    verifyToken: async () => ({ success: true, hostname: 'evil.example' }),
  }))
  assert.equal(wrongHost.status, 400)
  assert.deepEqual(await wrongHost.json(), { success: false, error: 'turnstile_failed' })
})

test('production retries use one stable Turnstile idempotency key and can reach existing persistence', async () => {
  const env = {
    NODE_ENV: 'production',
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'public-key',
    TURNSTILE_SECRET_KEY: 'private-secret',
  }
  const verified = new Map()
  const keys = []
  const verifyToken = async (token, _ip, _secret, idempotencyKey) => {
    keys.push(idempotencyKey)
    if (!idempotencyKey) return { success: false }
    const prior = verified.get(token)
    if (prior && prior !== idempotencyKey) return { success: false }
    verified.set(token, idempotencyKey)
    return { success: true, hostname: 'vivirenfuengirola.com' }
  }
  let writes = 0
  const options = acceptingOptions({
    env,
    verifyToken,
    createRequest: async () => (++writes === 1 ? 'created' : 'existing'),
  })
  const payload = { ...validPayload, token: 'single-use-token' }
  const first = await handlePlatformRequestPost(request('POST', payload), options)
  const retry = await handlePlatformRequestPost(request('POST', payload), options)
  assert.equal(first.status, 201)
  assert.equal(retry.status, 200)
  assert.deepEqual(await retry.json(), { success: true, outcome: 'existing' })
  assert.equal(keys.length, 2)
  assert.equal(keys[0], keys[1])
  assert.match(keys[0], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

test('default Turnstile verification uses a bounded abort signal', async () => {
  const env = {
    NODE_ENV: 'production',
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'public-key',
    TURNSTILE_SECRET_KEY: 'private-secret',
  }
  let signal
  const response = await handlePlatformRequestPost(request('POST', { ...validPayload, token: 'valid-token' }), acceptingOptions({
    env,
    fetchImpl: async (_url, options) => {
      signal = options.signal
      return Response.json({ success: true, hostname: 'vivirenfuengirola.com' })
    },
  }))
  assert.equal(response.status, 201)
  assert.ok(signal instanceof AbortSignal)
})

test('config reveals only the public Turnstile state and key', async () => {
  const env = {
    NODE_ENV: 'production',
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'public-key',
    TURNSTILE_SECRET_KEY: 'private-secret',
  }
  const response = await handlePlatformRequestConfigGet(request('GET', undefined), { env })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { turnstileEnabled: true, turnstileSiteKey: 'public-key' })
  assert.doesNotMatch(JSON.stringify(await handlePlatformRequestConfigGet(request('GET', undefined), { env }).then((item) => item.json())), /private-secret/)
})

test('idempotent persistence outcomes map to exact public responses', async () => {
  for (const [outcome, status] of [['created', 201], ['existing', 200]]) {
    const response = await handlePlatformRequestPost(request('POST'), acceptingOptions({
      createRequest: async () => outcome,
    }))
    assert.equal(response.status, status)
    assert.deepEqual(await response.json(), { success: true, outcome })
  }
})

test('Supabase adapter translates only a pending fingerprint conflict into existing', async () => {
  const payload = { fingerprint: 'fingerprint' }
  const inserted = await persistPlatformRequest({
    from: () => ({ insert: async () => ({ error: null }) }),
  }, payload)
  assert.equal(inserted, 'created')

  let selectedColumns
  const existing = await persistPlatformRequest({
    from: () => ({
      insert: async () => ({ error: { code: '23505' } }),
      select: (columns) => {
        selectedColumns = columns
        return { eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'request-id', status: 'pending' }, error: null }) }) }) }
      },
    }),
  }, payload)
  assert.equal(existing, 'existing')
  assert.equal(selectedColumns, 'id,status')

  await assert.rejects(
    persistPlatformRequest({ from: () => ({ insert: async () => ({ error: { code: '42501', message: 'secret database detail' } }) }) }, payload),
    /platform_request_insert_failed/,
  )
})
