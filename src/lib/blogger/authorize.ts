import { getOptionalIdentity } from '@/lib/auth'
import { assertBloggerSiteAccess } from '@/lib/blogger/access.mjs'
import { getBloggerSite } from '@/lib/blogger/sites.mjs'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

export async function authorizeBloggerSite(siteKey: string) {
  const identity = await getOptionalIdentity()
  if (!identity) throw Object.assign(new Error('Inicia sesión para usar Blogger.'), { status: 401 })
  const site = getBloggerSite(siteKey)
  const memberships = identity.role === 'client'
    ? (await getSupabaseAdminClient().from('blogger_site_memberships').select('user_id, site_key').eq('user_id', identity.userId).eq('site_key', siteKey)).data ?? []
    : []
  assertBloggerSiteAccess(identity, siteKey, memberships.map((item) => ({ userId: item.user_id, siteKey: item.site_key })))
  return { identity, ...site }
}
