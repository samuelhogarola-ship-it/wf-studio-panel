import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'

const ADMIN_HOST = 'admin.webfuengirola.com'
const PORTAL_HOST = 'portal.webfuengirola.com'

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const pathname = request.nextUrl.pathname

  // Only apply domain routing in production (known hosts)
  const isKnownHost = host === ADMIN_HOST || host === PORTAL_HOST

  if (isKnownHost) {
    // admin.webfuengirola.com: /cliente/* does not exist here
    if (host === ADMIN_HOST && pathname.startsWith('/cliente')) {
      return new NextResponse(null, { status: 404 })
    }

    // portal.webfuengirola.com: /paneladmin/* does not exist here
    if (host === PORTAL_HOST && pathname.startsWith('/paneladmin')) {
      return new NextResponse(null, { status: 404 })
    }

    // portal root → /cliente login
    if (host === PORTAL_HOST && pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/cliente'
      return NextResponse.redirect(url)
    }
  }

  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
