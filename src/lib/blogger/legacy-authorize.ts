import { authorizeBloggerSite } from '@/lib/blogger/authorize'

const SPORT_MASSAGE_SITE_KEY = 'sportmassagefuengirola'

/** The legacy API is a single-tenant Sport Massage runtime. */
export async function authorizeSportBlogger() {
  return authorizeBloggerSite(SPORT_MASSAGE_SITE_KEY, { allowedRoles: ['admin'] })
}
