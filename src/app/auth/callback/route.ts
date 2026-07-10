import { NextResponse, type NextRequest } from 'next/server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sanitizeInternalRedirect } from '@/lib/security/redirects.mjs'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = sanitizeInternalRedirect(requestUrl.searchParams.get('next'), {
    fallback: '/cliente/dashboard',
  })
  const appUrl = process.env.APP_URL

  if (!appUrl) {
    throw new Error('Missing APP_URL')
  }

  if (code) {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL(next, appUrl))
}
