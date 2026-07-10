import { NextResponse, type NextRequest } from 'next/server'

import { createSupabaseRouteClient } from '@/lib/supabase/server'
import { resolveRequestOrigin, sanitizeInternalRedirect } from '@/lib/security/redirects.mjs'

function getAppBaseUrl(request: NextRequest, requestUrl: URL) {
  return resolveRequestOrigin({
    forwardedHost: request.headers.get('x-forwarded-host'),
    forwardedProto: request.headers.get('x-forwarded-proto'),
    requestOrigin: requestUrl.origin,
    fallbackOrigin: process.env.APP_URL,
  })
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = sanitizeInternalRedirect(requestUrl.searchParams.get('next'), {
    fallback: '/cliente/dashboard',
  })
  const appUrl = getAppBaseUrl(request, requestUrl)
  const successUrl = new URL(next, appUrl)
  const successResponse = NextResponse.redirect(successUrl)

  try {
    if (code) {
      const supabase = createSupabaseRouteClient(request, successResponse)
      await supabase.auth.exchangeCodeForSession(code)
    }
  } catch {
    const errorUrl = new URL(next, appUrl)
    errorUrl.searchParams.set('error', 'callback_exchange_failed')
    return NextResponse.redirect(errorUrl)
  }

  return successResponse
}
