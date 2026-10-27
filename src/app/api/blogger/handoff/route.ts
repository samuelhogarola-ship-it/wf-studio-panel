import { NextResponse } from 'next/server'

import {
  createDirectBloggerSession,
  DIRECT_BLOGGER_COOKIE,
  loadDirectBloggerSessionConfig,
} from '@/lib/blogger/direct-access.mjs'
import { getCustomBloggerOrigin, getCustomBloggerSiteByHost } from '@/lib/blogger/custom-hosts.mjs'
import { resolveRequestOrigin } from '@/lib/security/redirects.mjs'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  buildLaunchSecurityHeaders,
  consumeLaunchTicket,
  type ConsumedLaunchTicket,
} from '@/lib/tools/launch-tickets.mjs'

export const runtime = 'nodejs'

const CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/
const SESSION_TTL_SECONDS = 8 * 60 * 60
const secureHeaders = buildLaunchSecurityHeaders()

function redirect(origin: string, error?: string) {
  const destination = new URL('/', origin)
  if (error) destination.searchParams.set('error', error)
  return new NextResponse(null, {
    status: 303,
    headers: { ...secureHeaders, Location: destination.toString() },
  })
}

function validBinding(
  consumed: ConsumedLaunchTicket | null,
  expected: { siteKey: string; audience: string },
): consumed is ConsumedLaunchTicket & { actorRole: 'client'; clientId: string } {
  return consumed?.protocol === 'wf-blogger-handoff/v1' &&
    consumed.siteKey === expected.siteKey &&
    consumed.audience === expected.audience &&
    consumed.actorRole === 'client' &&
    typeof consumed.userId === 'string' && consumed.userId.length > 0 &&
    typeof consumed.clientId === 'string' && consumed.clientId.length > 0 &&
    typeof consumed.projectId === 'string' && consumed.projectId.length > 0 &&
    Number.isFinite(Date.parse(consumed.expiresAt)) && Date.parse(consumed.expiresAt) > Date.now()
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const candidateSite = getCustomBloggerSiteByHost(forwardedHost ?? '') ??
    getCustomBloggerSiteByHost(requestUrl.hostname)
  if (!candidateSite) return new NextResponse(null, { status: 404 })

  const customOrigin = getCustomBloggerOrigin(candidateSite)
  if (!customOrigin) return new NextResponse(null, { status: 404 })
  const origin = resolveRequestOrigin({
    forwardedHost,
    forwardedProto: request.headers.get('x-forwarded-proto'),
    requestOrigin: requestUrl.origin,
    allowedHosts: [new URL(customOrigin).hostname],
  })
  if (origin !== customOrigin) return new NextResponse(null, { status: 404 })

  const keys = [...requestUrl.searchParams.keys()]
  const code = requestUrl.searchParams.get('code')
  if (keys.length !== 1 || keys[0] !== 'code' || !code || !CODE_PATTERN.test(code)) {
    return new NextResponse(null, { status: 404 })
  }

  try {
    const consumed = await consumeLaunchTicket(getSupabaseAdminClient(), {
      code,
      siteKey: candidateSite.key,
      audience: customOrigin,
    })
    if (!validBinding(consumed, { siteKey: candidateSite.key, audience: customOrigin })) {
      return redirect(customOrigin, 'handoff')
    }

    const { sessionSecret } = loadDirectBloggerSessionConfig(process.env)
    const response = redirect(customOrigin)
    response.cookies.set(DIRECT_BLOGGER_COOKIE, createDirectBloggerSession({
      secret: sessionSecret,
      siteKey: candidateSite.key,
      subject: {
        userId: consumed.userId,
        clientId: consumed.clientId,
        projectId: consumed.projectId,
      },
    }), {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    })
    return response
  } catch {
    return redirect(customOrigin, 'handoff')
  }
}
