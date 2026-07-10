import { NextResponse, type NextRequest } from 'next/server'

import { createSupabaseRouteClient } from '@/lib/supabase/server'
import { resolveRequestOrigin } from '@/lib/security/redirects.mjs'

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
  const appUrl = getAppBaseUrl(request, requestUrl)
  const successResponse = NextResponse.redirect(new URL('/auth/actualizar-contrasena', appUrl))

  try {
    if (code) {
      const supabase = createSupabaseRouteClient(request, successResponse)
      await supabase.auth.exchangeCodeForSession(code)
    }
  } catch {
    return NextResponse.redirect(new URL('/cliente/recuperar?error=callback_exchange_failed', appUrl))
  }

  return successResponse
}
