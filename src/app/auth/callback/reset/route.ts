import { NextResponse, type NextRequest } from 'next/server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const appUrl = process.env.APP_URL

  if (!appUrl) {
    throw new Error('Missing APP_URL')
  }

  if (code) {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL('/auth/actualizar-contrasena', appUrl))
}
