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
  const sportMassage = siteKey === 'sportmassagefuengirola'
  const directSession = sportMassage ? await getDirectBloggerSession() : null
  if (sportMassage && !directSession) {
    return <DirectBloggerLogin invalid={query?.error === 'invalid'} />
  }
  const identity = sportMassage ? null : await getOptionalIdentity()
  if (!sportMassage && !identity) notFound()

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
