import { notFound } from 'next/navigation'

import { DirectBloggerLogin } from '@/components/blogger/direct-blogger-login'
import { DirectBloggerShell } from '@/components/blogger/direct-blogger-shell'
import { authorizeBloggerSite } from '@/lib/blogger/authorize'
import { getDirectBloggerSession } from '@/lib/blogger/direct-access-server'
import { getBloggerEditorTarget } from '@/lib/blogger/editor.mjs'
import { getOptionalIdentity } from '@/lib/auth'
import { getBloggerSite } from '@/lib/blogger/sites.mjs'

export const dynamic = 'force-dynamic'

export default async function DirectBloggerPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteKey: string }>
  searchParams?: Promise<{ error?: string }>
}) {
  const [{ siteKey }, query] = await Promise.all([params, searchParams])
  const identity = await getOptionalIdentity()
  const directSession = siteKey === 'sportmassagefuengirola' && !identity ? await getDirectBloggerSession() : null
  if (!identity && !directSession) {
    if (siteKey !== 'sportmassagefuengirola') notFound()
    return <DirectBloggerLogin invalid={query?.error === 'invalid'} />
  }

  let authorization
  try {
    authorization = directSession ? getBloggerSite(siteKey) : await authorizeBloggerSite(siteKey)
  } catch {
    notFound()
  }

  const target = getBloggerEditorTarget(authorization.site)
  if (!target) notFound()

  return <DirectBloggerShell
    site={authorization.site}
    homeHref={directSession ? 'https://sportmassagefuengirola.com/' : identity?.role === 'admin' ? '/paneladmin/inicio' : '/cliente'}
    target={target}
    directSession={Boolean(directSession)}
  />
}
