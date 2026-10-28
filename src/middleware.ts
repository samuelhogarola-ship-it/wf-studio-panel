import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'
import { getCustomBloggerSiteByHost } from '@/lib/blogger/custom-hosts.mjs'
import { hasConsistentForwardedOrigin, resolveRequestOrigin, sanitizeInternalRedirect } from '@/lib/security/redirects.mjs'
import { SUPPORT_COOKIE_NAME } from '@/lib/support/constants'

const ADMIN_HOST = 'admin.webfuengirola.com'
const PORTAL_HOST = 'portal.webfuengirola.com'

function customHostCandidate(forwardedHost: string | null, requestHost: string) {
  if (forwardedHost && getCustomBloggerSiteByHost(forwardedHost)) return forwardedHost.toLowerCase()
  if (getCustomBloggerSiteByHost(requestHost)) return requestHost.toLowerCase()
  return null
}

function customBloggerPathAllowed(site: { key: string; blogger?: { runtime?: string } }, pathname: string) {
  if (pathname === '/api/blogger/direct-session' || pathname === '/api/blogger/handoff') return true
  if (site.key === 'sportmassagefuengirola' && pathname === '/brands/sportmassage/wf-blogger-preview.png') return true
  if (site.blogger?.runtime === 'central-legacy') {
    return ['/blogger/index.html', '/blogger/styles.css', '/blogger/app.js', '/api/build'].includes(pathname) ||
      pathname === '/api/posts' || pathname.startsWith('/api/posts/')
  }
  if (site.blogger?.runtime === 'central-multisite') {
    return pathname.startsWith('/blogger/editor/') ||
      pathname.startsWith(`/api/blogger/${encodeURIComponent(site.key)}/`)
  }
  return false
}

export async function middleware(request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const rawHost = request.headers.get('host')?.trim().toLowerCase() ?? ''
  if (rawHost.includes(',')) return new NextResponse(null, { status: 404 })
  const candidateCustomHost = customHostCandidate(forwardedHost, request.nextUrl.hostname) ??
    customHostCandidate(null, rawHost)
  const allowedHosts = [ADMIN_HOST, PORTAL_HOST, ...(candidateCustomHost ? [candidateCustomHost] : [])]
  const rawPublicHost = allowedHosts.includes(rawHost) ? rawHost : null
  const requestOrigin = forwardedHost === null && forwardedProto === null && rawPublicHost
    ? `https://${rawPublicHost}`
    : request.nextUrl.origin
  const origin = resolveRequestOrigin({
    forwardedHost,
    forwardedProto,
    requestOrigin,
    allowedHosts,
  })
  const host = new URL(origin).hostname
  const customBloggerSite = getCustomBloggerSiteByHost(host)
  const pathname = request.nextUrl.pathname
  const isPortalBloggerMutation = request.method === 'POST' &&
    request.headers.get('origin') === 'https://portal.webfuengirola.com' && (
      pathname === '/api/blogger/direct-session' ||
      /^\/api\/tools\/blogger\/[a-z0-9]+(?:-[a-z0-9]+)*\/launch$/.test(pathname)
    )
  const consistentProxyOrigin = hasConsistentForwardedOrigin({
    forwardedHost,
    forwardedProto,
    requestOrigin,
    allowedHosts,
  })
  if (!consistentProxyOrigin && !isPortalBloggerMutation) {
    return new NextResponse(null, { status: 404 })
  }
  const hasSupportRoutingHint = Boolean(request.cookies?.get(SUPPORT_COOKIE_NAME)?.value)

  // Only apply domain routing in production (known hosts)
  const isKnownHost = host === ADMIN_HOST || host === PORTAL_HOST || customBloggerSite !== null
  if ((forwardedHost !== null || forwardedProto !== null) && !isKnownHost && !isPortalBloggerMutation) {
    return new NextResponse(null, { status: 404 })
  }

  if (isKnownHost) {
    if (customBloggerSite) {
      if (pathname === '/' && ['GET', 'HEAD'].includes(request.method)) {
        const url = new URL(request.nextUrl.toString())
        url.pathname = `/acceso/blogger/${encodeURIComponent(customBloggerSite.key)}`
        return NextResponse.rewrite(url)
      }
      if (!customBloggerPathAllowed(customBloggerSite, pathname)) {
        return new NextResponse(null, { status: 404 })
      }
    }

    if (host === ADMIN_HOST && (
      pathname.startsWith('/acceso/blogger') ||
      pathname === '/api/blogger/direct-session'
    )) {
      return new NextResponse(null, { status: 404 })
    }

    // A support cookie only routes the request. PortalViewer validates it and
    // remains the fail-closed authorization boundary for every client page.
    if (host === ADMIN_HOST && pathname.startsWith('/cliente') && !hasSupportRoutingHint) {
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
    if (host === PORTAL_HOST && pathname.startsWith('/paneladmin')) {
      return new NextResponse(null, { status: 404 })
    }

    // portal root → /cliente login
    if (host === PORTAL_HOST && pathname === '/') {
      return NextResponse.redirect(new URL('/cliente', origin))
    }
  }

  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
