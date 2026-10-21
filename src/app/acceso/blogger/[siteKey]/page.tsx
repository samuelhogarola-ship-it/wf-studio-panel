import { notFound, redirect } from 'next/navigation'

import { DirectBloggerShell } from '@/components/blogger/direct-blogger-shell'
import { authorizeBloggerSite } from '@/lib/blogger/authorize'
import { getBloggerEditorTarget } from '@/lib/blogger/editor.mjs'
import { getOptionalIdentity } from '@/lib/auth'
import { buildCanonicalClientLoginUrl, sanitizeClientDestination } from '@/lib/security/redirects.mjs'

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
  if (!identity) {
    const destination = sanitizeClientDestination(`/acceso/blogger/${siteKey}`)
    redirect(buildCanonicalClientLoginUrl(destination, query?.error).toString())
  }

  let authorization
  try {
    authorization = await authorizeBloggerSite(siteKey)
  } catch {
    notFound()
  }

  const target = getBloggerEditorTarget(authorization.site)
  if (!target) notFound()

  return <DirectBloggerShell
    site={authorization.site}
    homeHref={identity.role === 'admin' ? '/paneladmin/inicio' : '/cliente'}
    target={target}
  />
}
