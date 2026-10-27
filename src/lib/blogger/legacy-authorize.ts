import { authorizeBloggerSite } from '@/lib/blogger/authorize'
import { getDirectBloggerSession } from '@/lib/blogger/direct-access-server'
import { getBloggerSite } from '@/lib/blogger/sites.mjs'

const SPORT_MASSAGE_SITE_KEY = 'sportmassagefuengirola'

/** The legacy API is a single-tenant Sport Massage runtime. */
export async function authorizeSportBlogger() {
  const directSession = await getDirectBloggerSession()
  if (directSession?.siteKey === SPORT_MASSAGE_SITE_KEY) {
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
  return authorizeBloggerSite(SPORT_MASSAGE_SITE_KEY)
}
