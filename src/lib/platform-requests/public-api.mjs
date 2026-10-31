import { createHash } from 'node:crypto'

import { z } from 'zod'

import { normalizeDirectoryIdentity, parseDirectoryProfileInput } from '../fichero/validation.mjs'

const BODY_LIMIT_BYTES = 32 * 1024
const PROFILE_LIMIT_BYTES = 24 * 1024
const PROFILE_MAX_DEPTH = 5
const PROFILE_MAX_KEYS = 100
const PROFILE_MAX_ITEMS = 111
const TURNSTILE_TIMEOUT_MS = 8_000
const BUSINESS_PROFILE_KEYS = new Set([
  'schema_version', 'catalog', 'canonicalSlug', 'legalName', 'displayName', 'cif',
  'contactEmail', 'phone', 'whatsapp', 'website', 'address', 'latitude', 'longitude',
  'categoryKey', 'categoryLabel', 'neighborhoodKeys', 'shortDescription',
  'longDescription', 'seoTitle', 'seoDescription', 'services', 'schedule', 'photos', 'plan',
])

const PRODUCTION_ORIGINS = new Map([
  ['https://vivirenfuengirola.com', new Set(['vivir-fuengirola', 'vivir-fuengirola-negocios'])],
  ['https://www.vivirenfuengirola.com', new Set(['vivir-fuengirola', 'vivir-fuengirola-negocios'])],
  ['https://conocefuengirola.com', new Set(['conoce-fuengirola'])],
  ['https://www.conocefuengirola.com', new Set(['conoce-fuengirola'])],
])

const payloadSchema = z.object({
  platform: z.enum(['vivir-fuengirola', 'vivir-fuengirola-negocios', 'conoce-fuengirola']),
  requestType: z.enum(['client', 'business', 'subscription_interest']),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(80).optional().default(''),
  company: z.string().trim().max(160).optional().default(''),
  message: z.string().trim().max(5_000).optional().default(''),
  profile: z.unknown().optional().default({}),
  sourceUrl: z.string().trim().url().max(500).optional().default(''),
  website: z.string().trim().max(200).optional().default(''),
  token: z.string().trim().max(4_096).optional().default(''),
}).strict()

function developmentOrigin(env) {
  if (env.NODE_ENV === 'production') return null
  const configured = String(env.PLATFORM_REQUEST_DEV_ORIGIN || '').trim()
  if (!configured) return null
  try {
    const parsed = new URL(configured)
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== configured) return null
    return parsed.origin
  } catch {
    return null
  }
}

function allowedPlatforms(origin, env) {
  const production = PRODUCTION_ORIGINS.get(origin)
  if (production) return production
  return origin === developmentOrigin(env)
    ? new Set(['vivir-fuengirola', 'vivir-fuengirola-negocios', 'conoce-fuengirola'])
    : null
}

function requestOrigin(request, env) {
  const origin = request.headers.get('origin')
  return origin && allowedPlatforms(origin, env) ? origin : null
}

function corsHeaders(origin, methods) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body, status, origin, methods) {
  return Response.json(body, { status, headers: corsHeaders(origin, methods) })
}

function turnstileConfiguration(env) {
  const siteKey = String(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || env.TURNSTILE_SITE_KEY || '').trim()
  const secret = String(env.TURNSTILE_SECRET_KEY || '').trim()
  if (siteKey && secret) return { state: 'enabled', siteKey, secret }
  if (siteKey || secret || env.NODE_ENV === 'production') return { state: 'unavailable' }
  return { state: 'disabled' }
}

function inspectProfile(value, depth = 1, state = { keys: 0, items: 0 }) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > PROFILE_MAX_DEPTH) return false
  for (const [key, child] of Object.entries(value)) {
    state.keys += 1
    if (state.keys > PROFILE_MAX_KEYS || key.length > 120) return false
    if (Array.isArray(child)) {
      state.items += child.length
      if (state.items > PROFILE_MAX_ITEMS || child.some(item => item !== null && !['string', 'number', 'boolean'].includes(typeof item))) return false
    } else if (child && typeof child === 'object') {
      if (!inspectProfile(child, depth + 1, state)) return false
    } else if (!['string', 'number', 'boolean'].includes(typeof child) && child !== null) {
      return false
    }
  }
  return true
}

function validProfile(value) {
  if (!inspectProfile(value)) return false
  return new TextEncoder().encode(JSON.stringify(value)).byteLength <= PROFILE_LIMIT_BYTES
}

async function verifyTurnstileToken(token, remoteIp, secret, idempotencyKey, fetchImpl = fetch) {
  const formData = new FormData()
  formData.append('secret', secret)
  formData.append('response', token)
  if (remoteIp) formData.append('remoteip', remoteIp)
  formData.append('idempotency_key', idempotencyKey)
  const response = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
    cache: 'no-store',
    signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
  })
  if (!response.ok) return { success: false }
  const payload = await response.json()
  return { success: Boolean(payload.success), hostname: typeof payload.hostname === 'string' ? payload.hostname : undefined }
}

function turnstileIdempotencyKey(token, requestFingerprint) {
  const bytes = Buffer.from(createHash('sha256').update(`${token}|${requestFingerprint}`).digest('hex').slice(0, 32), 'hex')
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

async function readBoundedBody(request) {
  if (!request.body) return { text: '', oversized: false }
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let size = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > BODY_LIMIT_BYTES) {
      await reader.cancel('platform_request_body_too_large')
      return { text: '', oversized: true }
    }
    text += decoder.decode(value, { stream: true })
  }
  text += decoder.decode()
  return { text, oversized: false }
}

function fingerprint(platform, requestType, email) {
  return createHash('sha256').update(`${platform}|${requestType}|${email}`).digest('hex')
}

function parseBusinessProfile(value, fallbackEmail) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (Object.keys(value).some(key => !BUSINESS_PROFILE_KEYS.has(key))) return null
  if (value.schema_version !== 'fichero.v1' || value.catalog !== 'fuengirola') return null

  const profileInput = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== 'schema_version' && key !== 'catalog'),
  )
  const parsed = parseDirectoryProfileInput(profileInput)
  if (!parsed.success) return null
  const identity = normalizeDirectoryIdentity({
    ...parsed.data,
    contactEmail: parsed.data.contactEmail ?? fallbackEmail,
  })
  if (!identity.normalizedCif && (!identity.normalizedEmail || !identity.normalizedDomain || !identity.normalizedName)) return null

  return {
    profileData: {
      schema_version: 'fichero.v1',
      catalog: 'fuengirola',
      profile: parsed.data,
      identity,
    },
    fingerprint: createHash('sha256').update(identity.normalizedCif
      ? `business|fuengirola|cif:${identity.normalizedCif}`
      : `business|fuengirola|email:${identity.normalizedEmail}|domain:${identity.normalizedDomain}|name:${identity.normalizedName}`)
      .digest('hex'),
  }
}

export function handlePlatformRequestOptions(request, { env = process.env } = {}) {
  const origin = requestOrigin(request, env)
  if (!origin) return Response.json({ error: 'forbidden_origin' }, { status: 403 })
  return new Response(null, { status: 204, headers: corsHeaders(origin, 'POST,OPTIONS') })
}

export async function handlePlatformRequestConfigGet(request, { env = process.env } = {}) {
  const origin = requestOrigin(request, env)
  if (!origin) return Response.json({ error: 'forbidden_origin' }, { status: 403 })
  const config = turnstileConfiguration(env)
  if (config.state === 'unavailable') return json({ error: 'requests_not_configured' }, 503, origin, 'GET,OPTIONS')
  if (config.state === 'disabled') return json({ turnstileEnabled: false }, 200, origin, 'GET,OPTIONS')
  return json({ turnstileEnabled: true, turnstileSiteKey: config.siteKey }, 200, origin, 'GET,OPTIONS')
}

export async function handlePlatformRequestPost(request, {
  env = process.env,
  fetchImpl = fetch,
  verifyToken = (token, remoteIp, secret, idempotencyKey) => verifyTurnstileToken(token, remoteIp, secret, idempotencyKey, fetchImpl),
  createRequest,
} = {}) {
  const origin = requestOrigin(request, env)
  if (!origin) return Response.json({ success: false, error: 'forbidden_origin' }, { status: 403 })
  const methods = 'POST,OPTIONS'
  const config = turnstileConfiguration(env)
  if (config.state === 'unavailable') {
    return json({ success: false, error: 'requests_not_configured' }, 503, origin, methods)
  }

  try {
    const body = await readBoundedBody(request)
    if (body.oversized) {
      return json({ success: false, error: 'invalid_payload' }, 400, origin, methods)
    }
    const parsed = payloadSchema.safeParse(JSON.parse(body.text))
    if (!parsed.success || !validProfile(parsed.data.profile)) {
      return json({ success: false, error: 'invalid_payload' }, 400, origin, methods)
    }

    const data = parsed.data
    const platforms = allowedPlatforms(origin, env)
    if (!platforms?.has(data.platform)) {
      return json({ success: false, error: 'platform_not_allowed' }, 403, origin, methods)
    }
    if (data.sourceUrl && new URL(data.sourceUrl).origin !== origin) {
      return json({ success: false, error: 'invalid_payload' }, 400, origin, methods)
    }
    if (data.website) return json({ success: true, outcome: 'created' }, 201, origin, methods)

    const business = data.requestType === 'business'
      ? parseBusinessProfile(data.profile, data.email)
      : null
    if (data.requestType === 'business' && (
      !business || !['vivir-fuengirola-negocios', 'conoce-fuengirola'].includes(data.platform)
    )) {
      return json({ success: false, error: 'invalid_payload' }, 400, origin, methods)
    }

    const requestFingerprint = business?.fingerprint ?? fingerprint(data.platform, data.requestType, data.email)
    if (config.state === 'enabled') {
      if (!data.token) return json({ success: false, error: 'invalid_payload' }, 400, origin, methods)
      const verification = await verifyToken(
        data.token,
        request.headers.get('x-forwarded-for'),
        config.secret,
        turnstileIdempotencyKey(data.token, requestFingerprint),
      )
      if (!verification.success || verification.hostname !== new URL(origin).hostname) {
        return json({ success: false, error: 'turnstile_failed' }, 400, origin, methods)
      }
    }

    if (typeof createRequest !== 'function') throw new Error('platform_request_dependency_missing')
    const outcome = await createRequest({
      platform: data.platform,
      request_type: data.requestType,
      name: data.name,
      email: data.email,
      phone: data.phone,
      company: data.company,
      message: data.message,
      profile_data: business?.profileData ?? data.profile,
      source_url: data.sourceUrl,
      fingerprint: requestFingerprint,
    })
    if (outcome === 'existing') return json({ success: true, outcome }, 200, origin, methods)
    if (outcome !== 'created') throw new Error('platform_request_invalid_outcome')
    return json({ success: true, outcome }, 201, origin, methods)
  } catch {
    console.error('Public platform request submission failed')
    return json({ success: false, error: 'server_error' }, 500, origin, methods)
  }
}

export async function persistPlatformRequest(supabase, payload) {
  const { error } = await supabase.from('platform_requests').insert(payload)
  if (!error) return 'created'
  if (error.code !== '23505') throw new Error('platform_request_insert_failed')

  const { data, error: lookupError } = await supabase
    .from('platform_requests')
    .select('id,status')
    .eq('fingerprint', payload.fingerprint)
    .eq('status', 'pending')
    .maybeSingle()
  if (lookupError || !data) throw new Error('platform_request_conflict_unresolved')
  return 'existing'
}
