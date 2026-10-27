import { NextResponse } from 'next/server'

import {
  createDirectBloggerSession,
  DIRECT_BLOGGER_COOKIE,
  loadDirectBloggerConfig,
  verifyDirectBloggerPassword,
} from '@/lib/blogger/direct-access.mjs'
import { assertTrustedMutation } from '@/lib/security/mutations.mjs'

export const runtime = 'nodejs'

const DESTINATION = '/acceso/blogger/sportmassagefuengirola'
const SESSION_TTL_SECONDS = 8 * 60 * 60

function allowedHost(url: URL) {
  return url.hostname === 'portal.webfuengirola.com' || url.hostname === 'localhost' || url.hostname === '127.0.0.1'
}

function redirect(url: URL, destination = DESTINATION) {
  return new NextResponse(null, { status: 303, headers: { location: new URL(destination, url.origin).toString() } })
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  if (!allowedHost(url)) return new NextResponse(null, { status: 404 })
  try {
    assertTrustedMutation(request)
  } catch (error) {
    return NextResponse.json({ error: 'forbidden' }, { status: (error as { status?: number }).status ?? 403 })
  }

  const form = await request.formData().catch(() => null)
  const action = form?.get('action')
  if (action === 'logout') {
    const response = redirect(url)
    response.cookies.set(DIRECT_BLOGGER_COOKIE, '', {
      httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 0,
    })
    return response
  }
  if (action !== 'login') return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  try {
    const config = loadDirectBloggerConfig(process.env)
    const username = String(form?.get('username') ?? '').trim().toLowerCase()
    const password = String(form?.get('password') ?? '')
    const passwordValid = await verifyDirectBloggerPassword(password, config.passwordHash)
    if (username !== config.username || !passwordValid) return redirect(url, `${DESTINATION}?error=invalid`)

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
