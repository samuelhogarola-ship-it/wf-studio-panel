import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

export const DIRECT_BLOGGER_COOKIE = '__Host-wf_blogger'
export const DIRECT_BLOGGER_SITE_KEY = 'sportmassagefuengirola'
export const DIRECT_BLOGGER_USERNAME = 'sportmassagefuengirola@gmail.com'
export const DIRECT_BLOGGER_AUDIENCE = 'portal.webfuengirola.com'
export const DIRECT_BLOGGER_SCOPE = 'blogger:central'

const HASH_PREFIX = 'scrypt$v1'
const SITE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SCRYPT_OPTIONS = Object.freeze({ N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
const scrypt = promisify(scryptCallback)

function safeEqual(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  return a.length === b.length && timingSafeEqual(a, b)
}

function strong(value) {
  return typeof value === 'string' && value.length >= 20 && value.length <= 256 &&
    /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value) &&
    new Set(value).size >= 12
}

function supportedPasswordHash(value) {
  if (typeof value !== 'string') return false
  const parts = value.split('$')
  if (parts.length !== 4 || `${parts[0]}$${parts[1]}` !== HASH_PREFIX) return false
  try {
    return Buffer.from(parts[2], 'base64url').length === 16 && Buffer.from(parts[3], 'base64url').length === 32
  } catch { return false }
}

export async function generateDirectBloggerPasswordHash(password, { salt = randomBytes(16) } = {}) {
  if (!strong(password) || !Buffer.isBuffer(salt) || salt.length !== 16) throw new Error('Blogger password must be strong')
  const derived = await scrypt(password, salt, 32, SCRYPT_OPTIONS)
  return `${HASH_PREFIX}$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`
}

export async function verifyDirectBloggerPassword(password, encoded) {
  if (typeof password !== 'string' || password.length < 1 || password.length > 256 || !supportedPasswordHash(encoded)) return false
  const [, , saltEncoded, hashEncoded] = encoded.split('$')
  const expected = Buffer.from(hashEncoded, 'base64url')
  const actual = await scrypt(password, Buffer.from(saltEncoded, 'base64url'), expected.length, SCRYPT_OPTIONS)
  return timingSafeEqual(expected, Buffer.from(actual))
}

export function loadDirectBloggerConfig(env = process.env) {
  const username = env.SPORT_BLOGGER_DIRECT_USERNAME?.trim().toLowerCase()
  const passwordHash = env.SPORT_BLOGGER_DIRECT_PASSWORD_HASH?.trim()
  const { sessionSecret } = loadDirectBloggerSessionConfig(env)
  if (username !== DIRECT_BLOGGER_USERNAME || !supportedPasswordHash(passwordHash)) {
    throw new Error('Direct Blogger access is unavailable')
  }
  return Object.freeze({ username, passwordHash, sessionSecret, siteKey: DIRECT_BLOGGER_SITE_KEY })
}

export function loadDirectBloggerSessionConfig(env = process.env) {
  const configured = env.SPORT_BLOGGER_DIRECT_SESSION_SECRET?.trim()
  if (configured) {
    if (!strong(configured)) throw new Error('Direct Blogger session is unavailable')
    return Object.freeze({ sessionSecret: configured, siteKey: DIRECT_BLOGGER_SITE_KEY })
  }
  const serverSecret = env.SUPABASE_SECRET_KEY?.trim()
  if (typeof serverSecret !== 'string' || serverSecret.length < 32) {
    throw new Error('Direct Blogger session is unavailable')
  }
  const derived = createHmac('sha256', serverSecret)
    .update('wf-studio/sport-blogger-session/v1', 'utf8')
    .digest('base64url')
  return Object.freeze({ sessionSecret: `derived_${derived}!Aa1`, siteKey: DIRECT_BLOGGER_SITE_KEY })
}

export function createDirectBloggerSession({
  secret,
  siteKey = DIRECT_BLOGGER_SITE_KEY,
  subject = null,
  now = Date.now(),
  ttlMs = 8 * 60 * 60 * 1000,
}) {
  const validSubject = subject === null || (
    typeof subject === 'object' &&
    typeof subject.userId === 'string' && subject.userId &&
    typeof subject.clientId === 'string' && subject.clientId &&
    typeof subject.projectId === 'string' && subject.projectId
  )
  if (!strong(secret) || !SITE_KEY_PATTERN.test(siteKey) || !validSubject ||
    !Number.isSafeInteger(now) || !Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > 24 * 60 * 60 * 1000) {
    throw new Error('Direct Blogger session configuration is invalid')
  }
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    siteKey,
    audience: DIRECT_BLOGGER_AUDIENCE,
    scope: DIRECT_BLOGGER_SCOPE,
    source: subject ? 'panel' : 'direct',
    subject,
    expiresAt: now + ttlMs,
  })).toString('base64url')
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function verifyDirectBloggerSession(token, { secret, siteKey = DIRECT_BLOGGER_SITE_KEY, now = Date.now() }) {
  if (typeof token !== 'string' || !strong(secret)) return null
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra) return null
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  if (!safeEqual(signature, expected)) return null
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    const validSubject = claims?.source === 'direct'
      ? claims.subject === null
      : claims?.source === 'panel' && typeof claims.subject?.userId === 'string' && claims.subject.userId &&
        typeof claims.subject?.clientId === 'string' && claims.subject.clientId &&
        typeof claims.subject?.projectId === 'string' && claims.subject.projectId
    if (claims?.v !== 1 || claims.siteKey !== siteKey || !SITE_KEY_PATTERN.test(claims.siteKey) ||
      claims.audience !== DIRECT_BLOGGER_AUDIENCE || claims.scope !== DIRECT_BLOGGER_SCOPE ||
      !validSubject || !Number.isSafeInteger(claims.expiresAt) || claims.expiresAt <= now) return null
    return {
      siteKey: claims.siteKey,
      audience: claims.audience,
      scope: claims.scope,
      source: claims.source,
      subject: claims.subject,
      expiresAt: claims.expiresAt,
    }
  } catch { return null }
}
