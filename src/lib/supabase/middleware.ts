import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

import { getPublicEnv } from '@/lib/env'
import type { Database } from '@/lib/supabase/types'

const ADMIN_PROTECTED_PREFIXES = ['/paneladmin/dashboard', '/paneladmin/clientes', '/paneladmin/bonos', '/paneladmin/actividades', '/paneladmin/facturas']
const CLIENT_PROTECTED_PREFIXES = ['/cliente/dashboard']

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  const env = getPublicEnv()

  if (!env.supabaseUrl || !env.supabaseKey) {
    return response
  }

  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const needsAdminSession = ADMIN_PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  const needsClientSession = CLIENT_PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  if (needsAdminSession && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/paneladmin'
    url.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(url)
  }

  if (needsClientSession && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/cliente'
    url.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(url)
  }

  return response
}
