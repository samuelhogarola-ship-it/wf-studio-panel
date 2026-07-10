import { NextResponse, type NextRequest } from 'next/server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

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
  const appUrl = getAppBaseUrl(request, requestUrl)

  if (code) {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL('/auth/actualizar-contrasena', appUrl))
}
