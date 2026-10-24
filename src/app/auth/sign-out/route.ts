import { NextResponse, type NextRequest } from 'next/server'

import { createSupabaseRouteClient, createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveRequestOrigin } from '@/lib/security/redirects.mjs'
import { getOptionalSupportViewer } from '@/lib/support/portal-viewer'
import { clearSupportCookie, endSupportSession, SUPPORT_COOKIE_NAME } from '@/lib/support/support-session'
import { cookies } from 'next/headers'

function getAppBaseUrl(request: NextRequest, requestUrl: URL) {
  return resolveRequestOrigin({
    forwardedHost: request.headers.get('x-forwarded-host'),
    forwardedProto: request.headers.get('x-forwarded-proto'),
    requestOrigin: requestUrl.origin,
    fallbackOrigin: process.env.APP_URL,
    allowedHosts: ['admin.webfuengirola.com', 'portal.webfuengirola.com'],
  })
}

export async function POST(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const appUrl = getAppBaseUrl(request, requestUrl)
  const requestOrigin = request.headers.get('origin')
  if (requestOrigin && requestOrigin !== new URL(appUrl).origin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const supportViewer = await getOptionalSupportViewer()
  if (supportViewer) {
    const token = (await cookies()).get(SUPPORT_COOKIE_NAME)?.value
    const db = await createSupabaseServerClient()
    await endSupportSession(db, { adminUserId: supportViewer.identity.userId, token }, 'manual')
    const response = NextResponse.redirect(new URL(supportViewer.returnPath, appUrl), 303)
    response.cookies.set(clearSupportCookie())
    return response
  }
  const formData = await request.formData()
  const redirectTarget = formData.get('redirect') === 'admin' ? '/paneladmin' : '/cliente'
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
