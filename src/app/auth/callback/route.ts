import { NextResponse, type NextRequest } from 'next/server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sanitizeInternalRedirect } from '@/lib/security/redirects.mjs'

function getAppBaseUrl(request: NextRequest, requestUrl: URL) {
  if (process.env.APP_URL) {
    return process.env.APP_URL
  }

  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }

  return requestUrl.origin
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = sanitizeInternalRedirect(requestUrl.searchParams.get('next'), {
    fallback: '/cliente/dashboard',
  })
  const appUrl = getAppBaseUrl(request, requestUrl)

  try {
    if (code) {
      const supabase = await createSupabaseServerClient()
      await supabase.auth.exchangeCodeForSession(code)
    }
  } catch {
    const errorUrl = new URL(next, appUrl)
    errorUrl.searchParams.set('error', 'callback_exchange_failed')
    return NextResponse.redirect(errorUrl)
  }

  return NextResponse.redirect(new URL(next, appUrl))
}
