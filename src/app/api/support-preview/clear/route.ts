import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { clearSupportCookie, SUPPORT_COOKIE_NAME } from '@/lib/support/support-session'
import { resolveSupportClearRedirect } from '@/lib/support/portal-viewer'

export async function GET(request: Request) {
  const identity = await requireAdmin()
  const cookieStore = await cookies()
  const token = cookieStore.get(SUPPORT_COOKIE_NAME)?.value
  const db = await createSupabaseServerClient()
  const target = await resolveSupportClearRedirect(db, { adminUserId: identity.userId, token })
  const destination = new URL(target.returnPath, request.url)
  destination.searchParams.set('supportPreview', target.reason)
  const response = NextResponse.redirect(destination)
  response.cookies.set(clearSupportCookie())
  return response
}
