import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

import { getPublicEnv } from '@/lib/env'
import { getProtectedArea } from '@/lib/security/redirects.mjs'
import type { Database } from '@/lib/supabase/types'

type SessionUpdateOptions = {
  requiredAuthenticatedRole?: 'admin'
}

export async function updateSession(request: NextRequest, options: SessionUpdateOptions = {}) {
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

  if (user && options.requiredAuthenticatedRole) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role !== options.requiredAuthenticatedRole) {
      await supabase.auth.signOut()
      const denied = new NextResponse(null, { status: 404 })
      response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie))
      return denied
    }
  }

  const pathname = request.nextUrl.pathname
  const protectedArea = getProtectedArea(pathname)

  if (protectedArea === 'admin' && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/paneladmin'
    url.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(url)
  }

  if (protectedArea === 'client' && !user) {
    if (options.requiredAuthenticatedRole) {
      return new NextResponse(null, { status: 404 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/cliente'
    url.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(url)
  }

  return response
}
