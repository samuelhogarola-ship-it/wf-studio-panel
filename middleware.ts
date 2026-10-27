import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'
import { sanitizeInternalRedirect } from '@/lib/security/redirects.mjs'
import { SUPPORT_COOKIE_NAME } from '@/lib/support/constants'

const ADMIN_HOST = 'admin.webfuengirola.com'
const PORTAL_HOST = 'portal.webfuengirola.com'

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const pathname = request.nextUrl.pathname
  const hasSupportRoutingHint = Boolean(request.cookies?.get(SUPPORT_COOKIE_NAME)?.value)

  // Only apply domain routing in production (known hosts)
  const isKnownHost = host === ADMIN_HOST || host === PORTAL_HOST
  const isLegacyBloggerAsset = pathname === '/blogger' || pathname.startsWith('/blogger/')
  const isLegacyBloggerApi = pathname === '/api/posts' || pathname.startsWith('/api/posts/') || pathname === '/api/build'

  if (isKnownHost) {
    if (host === ADMIN_HOST && pathname.startsWith('/cliente') && !hasSupportRoutingHint) {
      return new NextResponse(null, { status: 404 })
    }

    if (host === ADMIN_HOST && pathname.startsWith('/acceso/blogger')) {
      return new NextResponse(null, { status: 404 })
    }

    if (host === ADMIN_HOST && pathname === '/auth/callback') {
      const destination = request.nextUrl.searchParams.get('next')
      const adminDestination = sanitizeInternalRedirect(destination, {
        fallback: '',
        allowedPrefixes: ['/paneladmin'],
      })
      if (destination !== null && adminDestination !== destination) {
        return new NextResponse(null, { status: 404 })
      }
    }

    // portal.webfuengirola.com: /paneladmin/* does not exist here
    if (host === PORTAL_HOST && (pathname.startsWith('/paneladmin') || isLegacyBloggerAsset || isLegacyBloggerApi)) {
      return new NextResponse(null, { status: 404 })
    }

    // portal root → /cliente login
    if (host === PORTAL_HOST && pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/cliente'
      return NextResponse.redirect(url)
    }
  }

  return updateSession(request, host === ADMIN_HOST
    ? {
        requiredAuthenticatedRole: 'admin',
        ...(isLegacyBloggerAsset ? { requireAuthentication: true } : {}),
      }
    : undefined)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
