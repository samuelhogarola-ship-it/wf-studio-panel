import { cookies, headers } from 'next/headers'

import {
  DIRECT_BLOGGER_COOKIE,
  loadDirectBloggerSessionConfig,
  verifyDirectBloggerSession,
} from '@/lib/blogger/direct-access.mjs'
import { resolveRequestOrigin } from '@/lib/security/redirects.mjs'

export async function getDirectBloggerSession(siteKey = 'sportmassagefuengirola') {
  try {
    const requestHeaders = await headers()
    const rawHost = requestHeaders.get('host')?.trim().toLowerCase() ?? ''
    const requestOrigin = rawHost
      ? `${rawHost.startsWith('localhost') || rawHost.startsWith('127.0.0.1') ? 'http' : 'https'}://${rawHost}`
      : 'http://invalid.local'
    const hostname = new URL(resolveRequestOrigin({
      forwardedHost: requestHeaders.get('x-forwarded-host'),
      forwardedProto: requestHeaders.get('x-forwarded-proto'),
      requestOrigin,
    })).hostname
    if (hostname !== 'portal.webfuengirola.com' && hostname !== 'localhost' && hostname !== '127.0.0.1') return null
    const config = loadDirectBloggerSessionConfig(process.env)
    const token = (await cookies()).get(DIRECT_BLOGGER_COOKIE)?.value
    if (!token) return null
    return verifyDirectBloggerSession(token, { secret: config.sessionSecret, siteKey })
  } catch {
    return null
  }
}
