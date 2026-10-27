import { NextResponse, type NextRequest } from 'next/server'

import { createSupabaseRouteClient } from '@/lib/supabase/server'
import {
  resolveRequestOrigin,
  sanitizeClientDestination,
  sanitizeInternalRedirect,
} from '@/lib/security/redirects.mjs'

function getAppBaseUrl(request: NextRequest, requestUrl: URL) {
  return resolveRequestOrigin({
    forwardedHost: request.headers.get('x-forwarded-host'),
    forwardedProto: request.headers.get('x-forwarded-proto'),
    requestOrigin: requestUrl.origin,
    fallbackOrigin: process.env.APP_URL,
    allowedHosts: ['admin.webfuengirola.com', 'portal.webfuengirola.com'],
  })
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? ''
  const isAdminHost = host.startsWith('admin.')
  const next = isAdminHost
    ? sanitizeInternalRedirect(requestUrl.searchParams.get('next'), {
        fallback: '/paneladmin/inicio',
        allowedPrefixes: ['/paneladmin'],
      })
    : sanitizeClientDestination(requestUrl.searchParams.get('next'))
  const appUrl = getAppBaseUrl(request, requestUrl)
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
