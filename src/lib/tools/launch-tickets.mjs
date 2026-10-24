import { createHash, randomBytes as secureRandomBytes, timingSafeEqual } from 'node:crypto'

export const HANDOFF_PROTOCOL = 'wf-blogger-handoff/v1'
const CODE_BYTES = 32
const CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/
const SITE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function hashCode(code) {
  return createHash('sha256').update(code, 'utf8').digest('hex')
}

function firstRow(data) {
  return Array.isArray(data) ? data[0] ?? null : data ?? null
}

function validateBinding({ siteKey, audience }) {
  if (!SITE_KEY_PATTERN.test(siteKey)) throw new Error('Invalid Blogger site binding')
  let parsed
  try {
    parsed = new URL(audience)
  } catch {
    throw new Error('Invalid Blogger audience')
  }
  if (parsed.protocol !== 'https:' || parsed.origin !== audience || parsed.username || parsed.password) {
    throw new Error('Invalid Blogger audience')
  }
}

export async function createLaunchTicket(db, input, options = {}) {
  validateBinding(input)
  if (!['admin', 'client'].includes(input.actorRole)) throw new Error('Invalid launch actor')
  const entropy = (options.randomBytes ?? secureRandomBytes)(CODE_BYTES)
  if (!Buffer.isBuffer(entropy) || entropy.length !== CODE_BYTES) throw new Error('Invalid launch entropy')
  const code = entropy.toString('base64url')
  const { data, error } = await db.rpc('create_tool_launch_ticket', {
    p_code_hash: hashCode(code),
    p_protocol: HANDOFF_PROTOCOL,
    p_site_key: input.siteKey,
    p_audience: input.audience,
    p_project_id: input.projectId,
    p_client_id: input.clientId ?? null,
    p_user_id: input.userId,
    p_actor_role: input.actorRole,
  })
  const row = firstRow(data)
  if (error || !row?.expires_at) throw new Error('Blogger launch is unavailable')
  return { protocol: HANDOFF_PROTOCOL, code, expiresAt: row.expires_at }
}

export async function consumeLaunchTicket(db, input) {
  validateBinding(input)
  if (!CODE_PATTERN.test(input.code)) return null
  const { data, error } = await db.rpc('consume_tool_launch_ticket', {
    p_code_hash: hashCode(input.code),
    p_protocol: HANDOFF_PROTOCOL,
    p_site_key: input.siteKey,
    p_audience: input.audience,
  })
  if (error) throw new Error('Blogger exchange is unavailable')
  const row = firstRow(data)
  if (!row) return null
  return {
    protocol: row.protocol,
    siteKey: row.site_key,
    audience: row.audience,
    projectId: row.project_id,
    clientId: row.client_id,
    userId: row.user_id,
    actorRole: row.actor_role,
    expiresAt: row.expires_at,
  }
}

export function getBloggerExchangeSecret(siteKey, env = process.env) {
  if (!SITE_KEY_PATTERN.test(siteKey)) return null
  const suffix = siteKey.toUpperCase().replaceAll('-', '_')
  return env[`WF_BLOGGER_HANDOFF_SECRET_${suffix}`]?.trim() || null
}

export function isBloggerExchangeAuthorized(authorization, expectedSecret) {
  if (typeof authorization !== 'string' || typeof expectedSecret !== 'string' || !expectedSecret) return false
  const match = authorization.match(/^Bearer ([^\s]+)$/)
  if (!match) return false
  const supplied = Buffer.from(match[1])
  const expected = Buffer.from(expectedSecret)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export function buildLaunchRedirectLocation({ destination, code, siteKey }) {
  const destinationUrl = new URL(destination)
  if (
    destinationUrl.protocol !== 'https:' || destinationUrl.username || destinationUrl.password ||
    destinationUrl.search || destinationUrl.hash || !CODE_PATTERN.test(code) || !SITE_KEY_PATTERN.test(siteKey)
  ) throw new Error('Invalid Blogger launch destination')
  destinationUrl.hash = new URLSearchParams({ protocol: HANDOFF_PROTOCOL, code, siteKey }).toString()
  return destinationUrl.toString()
}

export function serializeExchangeResponse(consumed) {
  validateBinding(consumed)
  if (
    consumed.protocol !== HANDOFF_PROTOCOL ||
    !['admin', 'client'].includes(consumed.actorRole) ||
    typeof consumed.userId !== 'string' || !consumed.userId ||
    (consumed.clientId !== null && (typeof consumed.clientId !== 'string' || !consumed.clientId)) ||
    typeof consumed.projectId !== 'string' || !consumed.projectId
  ) throw new Error('Invalid Blogger exchange result')
  return {
    protocol: HANDOFF_PROTOCOL,
    siteKey: consumed.siteKey,
    audience: consumed.audience,
    subject: {
      role: consumed.actorRole,
      userId: consumed.userId,
      clientId: consumed.clientId,
      projectId: consumed.projectId,
    },
  }
}

export function buildLaunchSecurityHeaders(formAction) {
  const directive = formAction ? new URL(formAction).origin : "'none'"
  return {
    'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
    Pragma: 'no-cache',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': `default-src 'none'; form-action ${directive}; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; style-src 'none'`,
    'X-Content-Type-Options': 'nosniff',
  }
}
