import { authorizeBloggerSite } from '@/lib/blogger/authorize'
import { getDirectBloggerSession } from '@/lib/blogger/direct-access-server'
import { getBloggerSite } from '@/lib/blogger/sites.mjs'
import { getOptionalIdentity } from '@/lib/auth'

const SPORT_MASSAGE_SITE_KEY = 'sportmassagefuengirola'

/** The legacy API is a single-tenant Sport Massage runtime. */
export async function authorizeSportBlogger() {
  const directSession = await getDirectBloggerSession(SPORT_MASSAGE_SITE_KEY)
  if (directSession?.siteKey === SPORT_MASSAGE_SITE_KEY && directSession.source === 'direct') {
    return {
      ...getBloggerSite(SPORT_MASSAGE_SITE_KEY),
      identity: {
        userId: 'direct-sport-blogger',
        email: 'sportmassagefuengirola@gmail.com',
        role: 'blogger' as const,
      },
      project: null,
      capability: null,
    }
  }
  if (directSession?.source === 'panel') return authorizeBloggerSite(SPORT_MASSAGE_SITE_KEY)
  const identity = await getOptionalIdentity()
  if (identity?.role !== 'admin') {
    throw Object.assign(new Error('Blogger access denied'), { status: identity ? 403 : 401 })
  }
  return authorizeBloggerSite(SPORT_MASSAGE_SITE_KEY)
}
