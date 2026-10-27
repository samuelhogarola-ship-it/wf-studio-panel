import { NextResponse } from 'next/server'

import {
  createDirectBloggerSession,
  DIRECT_BLOGGER_COOKIE,
  loadDirectBloggerConfig,
  verifyDirectBloggerPassword,
} from '@/lib/blogger/direct-access.mjs'
import { assertTrustedMutation } from '@/lib/security/mutations.mjs'
import { isTrustedInternalRequestOrigin, resolveRequestOrigin } from '@/lib/security/redirects.mjs'

export const runtime = 'nodejs'

const DESTINATION = '/acceso/blogger/sportmassagefuengirola'
const PORTAL_ORIGIN = 'https://portal.webfuengirola.com'
const SESSION_TTL_SECONDS = 8 * 60 * 60
const MAX_BODY_BYTES = 4_096
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 10
const attempts = new Map<string, { count: number; resetAt: number }>()

function allowedHost(url: URL) {
  return url.hostname === 'portal.webfuengirola.com' || url.hostname === 'localhost' || url.hostname === '127.0.0.1'
}

function redirect(url: URL, destination = DESTINATION) {
  return new NextResponse(null, { status: 303, headers: { location: new URL(destination, url.origin).toString() } })
}

function clientKey(request: Request) {
  const realIp = request.headers.get('x-real-ip')?.trim()
  const forwarded = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()
  const value = realIp || forwarded || 'unknown'
  return value.slice(0, 128)
}

function consumeAttempt(key: string, now = Date.now()) {
  if (attempts.size >= 10_000) {
    for (const [candidate, state] of attempts) if (state.resetAt <= now) attempts.delete(candidate)
  }
  if (attempts.size >= 10_000 && !attempts.has(key)) return false
  const current = attempts.get(key)
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS })
    return true
  }
  if (current.count >= MAX_ATTEMPTS) return false
  current.count += 1
  return true
}

async function readForm(request: Request) {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/x-www-form-urlencoded') throw Object.assign(new Error('unsupported'), { status: 415 })
  const declared = request.headers.get('content-length')
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) {
    throw Object.assign(new Error('too_large'), { status: 413 })
  }
  const reader = request.body?.getReader()
  if (!reader) return new URLSearchParams()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined)
      throw Object.assign(new Error('too_large'), { status: 413 })
    }
    chunks.push(value)
  }
  return new URLSearchParams(Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString('utf8'))
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const fallbackOrigin = forwardedHost === null && forwardedProto === null && isTrustedInternalRequestOrigin(requestUrl.origin)
    ? PORTAL_ORIGIN
    : undefined
  const origin = resolveRequestOrigin({
    forwardedHost,
    forwardedProto,
    requestOrigin: requestUrl.origin,
    fallbackOrigin,
  })
  const url = new URL(`${requestUrl.pathname}${requestUrl.search}`, origin)
  if (!allowedHost(url)) return new NextResponse(null, { status: 404 })
  try {
    assertTrustedMutation(request, { fallbackOrigin })
  } catch (error) {
    return NextResponse.json({ error: 'forbidden' }, { status: (error as { status?: number }).status ?? 403 })
  }

  let form: URLSearchParams
  try {
    form = await readForm(request)
  } catch (error) {
    return NextResponse.json({ error: 'bad_request' }, { status: (error as { status?: number }).status ?? 400 })
  }
  const action = form.get('action')
  if (action === 'logout') {
    const response = redirect(url)
    response.cookies.set(DIRECT_BLOGGER_COOKIE, '', {
      httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 0,
    })
    return response
  }
  if (action !== 'login') return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const key = clientKey(request)
  if (!consumeAttempt(key)) {
    return NextResponse.json({ error: 'too_many_attempts' }, { status: 429, headers: { 'retry-after': '300' } })
  }

  try {
    const config = loadDirectBloggerConfig(process.env)
    const username = String(form.get('username') ?? '').trim().toLowerCase()
    const password = String(form.get('password') ?? '')
    const passwordValid = await verifyDirectBloggerPassword(password, config.passwordHash)
    if (username !== config.username || !passwordValid) return redirect(url, `${DESTINATION}?error=invalid`)
    attempts.delete(key)

    const response = redirect(url)
    response.cookies.set(DIRECT_BLOGGER_COOKIE, createDirectBloggerSession({ secret: config.sessionSecret }), {
      httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: SESSION_TTL_SECONDS,
    })
    return response
  } catch (error) {
    console.error('[blogger/direct-session]', error)
    return NextResponse.json({ error: 'blogger_access_unavailable' }, { status: 503 })
  }
}
