import { cookies, headers } from 'next/headers'

import {
  DIRECT_BLOGGER_COOKIE,
  loadDirectBloggerSessionConfig,
  verifyDirectBloggerSession,
} from '@/lib/blogger/direct-access.mjs'
import { getCustomBloggerSiteByHost } from '@/lib/blogger/custom-hosts.mjs'
import { resolveRequestOrigin } from '@/lib/security/redirects.mjs'

export async function getDirectBloggerSession(siteKey = 'sportmassagefuengirola') {
  try {
    const requestHeaders = await headers()
    const rawHost = requestHeaders.get('host')?.trim().toLowerCase() ?? ''
    const internalPort = rawHost.endsWith(':3000')
    const requestOrigin = rawHost
      ? `${internalPort || rawHost.startsWith('localhost') || rawHost.startsWith('127.0.0.1') ? 'http' : 'https'}://${rawHost}`
      : 'http://invalid.local'
    const forwardedHost = requestHeaders.get('x-forwarded-host')
    const customCandidate = getCustomBloggerSiteByHost(forwardedHost ?? '') ?? getCustomBloggerSiteByHost(new URL(requestOrigin).hostname)
    const hostname = new URL(resolveRequestOrigin({
      forwardedHost,
      forwardedProto: requestHeaders.get('x-forwarded-proto'),
      requestOrigin,
      allowedHosts: [
        'admin.webfuengirola.com',
        'portal.webfuengirola.com',
        ...(customCandidate?.blogger.customOrigin ? [new URL(customCandidate.blogger.customOrigin as string).hostname] : []),
      ],
    })).hostname
    const customSite = getCustomBloggerSiteByHost(hostname)
    if (
      hostname !== 'portal.webfuengirola.com' && hostname !== 'localhost' && hostname !== '127.0.0.1' &&
      customSite?.key !== siteKey
    ) return null
    const config = loadDirectBloggerSessionConfig(process.env)
    const token = (await cookies()).get(DIRECT_BLOGGER_COOKIE)?.value
    if (!token) return null
    return verifyDirectBloggerSession(token, { secret: config.sessionSecret, siteKey })
  } catch {
    return null
  }
}
