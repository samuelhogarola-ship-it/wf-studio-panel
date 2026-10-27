import { NextResponse, type NextRequest } from 'next/server'

import { createSupabaseRouteClient } from '@/lib/supabase/server'
import {
  resolveRequestOrigin,
  sanitizeClientDestination,
  sanitizeInternalRedirect,
} from '@/lib/security/redirects.mjs'

const KNOWN_APP_HOSTS = ['admin.webfuengirola.com', 'portal.webfuengirola.com'] as const

function getCanonicalRequestHost(request: NextRequest, requestUrl: URL) {
  const headerHost = request.headers.get('host')?.split(',')[0]?.trim().toLowerCase() ?? ''
  const normalizedHeaderHost = headerHost.replace(/:\d+$/, '')
  if (KNOWN_APP_HOSTS.includes(normalizedHeaderHost as typeof KNOWN_APP_HOSTS[number])) {
    return normalizedHeaderHost
  }
  const urlHost = requestUrl.hostname.toLowerCase()
  return KNOWN_APP_HOSTS.includes(urlHost as typeof KNOWN_APP_HOSTS[number]) ? urlHost : null
}

function getAppBaseUrl(requestUrl: URL, canonicalHost: string | null) {
  if (canonicalHost) return `https://${canonicalHost}`
  return resolveRequestOrigin({
    forwardedHost: null,
    forwardedProto: null,
    requestOrigin: requestUrl.origin,
    fallbackOrigin: process.env.APP_URL,
    allowedHosts: [...KNOWN_APP_HOSTS],
  })
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const canonicalHost = getCanonicalRequestHost(request, requestUrl)
  const isAdminHost = canonicalHost === 'admin.webfuengirola.com'
  const next = isAdminHost
    ? sanitizeInternalRedirect(requestUrl.searchParams.get('next'), {
        fallback: '/paneladmin/inicio',
        allowedPrefixes: ['/paneladmin'],
      })
    : sanitizeClientDestination(requestUrl.searchParams.get('next'))
  const appUrl = getAppBaseUrl(requestUrl, canonicalHost)
  const successUrl = new URL(next, appUrl)
  const successResponse = NextResponse.redirect(successUrl)

  try {
    if (code) {
      const supabase = createSupabaseRouteClient(request, successResponse)
      await supabase.auth.exchangeCodeForSession(code)
      if (isAdminHost) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        const { data: profile } = user
          ? await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
          : { data: null }
        if (profile?.role !== 'admin') {
          await supabase.auth.signOut()
          successResponse.headers.set('location', new URL('/paneladmin?error=unauthorized', appUrl).toString())
        }
      }
    }
  } catch (error) {
    console.error('[auth/callback] exchangeCodeForSession failed', {
      appUrl,
      next,
      hasCode: Boolean(code),
      message: error instanceof Error ? error.message : 'unknown_error',
    })
    const errorUrl = new URL(successUrl)
    errorUrl.searchParams.set('error', 'callback_exchange_failed')
    return NextResponse.redirect(errorUrl)
  }

  return successResponse
}
