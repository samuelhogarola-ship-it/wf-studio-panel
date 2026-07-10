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

export async function POST(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const formData = await request.formData()
  const redirectTarget = formData.get('redirect') === 'admin' ? '/paneladmin' : '/cliente'
  const appUrl = getAppBaseUrl(request, requestUrl)
  const response = NextResponse.redirect(new URL(redirectTarget, appUrl))

  try {
    const supabase = createSupabaseRouteClient(request, response)
    await supabase.auth.signOut({ scope: 'local' })
  } catch (error) {
    console.error('[auth/sign-out] signOut failed', {
      redirectTarget,
      appUrl,
      message: error instanceof Error ? error.message : 'unknown_error',
    })
  }

  return response
}
