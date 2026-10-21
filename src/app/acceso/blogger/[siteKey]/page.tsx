import { notFound, redirect } from 'next/navigation'

import { DirectBloggerShell } from '@/components/blogger/direct-blogger-shell'
import { authorizeBloggerSite } from '@/lib/blogger/authorize'
import { getBloggerEditorTarget } from '@/lib/blogger/editor.mjs'
import { getOptionalIdentity } from '@/lib/auth'
import { sanitizeClientDestination } from '@/lib/security/redirects.mjs'

export const dynamic = 'force-dynamic'

export default async function DirectBloggerPage({ params }: { params: Promise<{ siteKey: string }> }) {
  const { siteKey } = await params
  const identity = await getOptionalIdentity()
  if (!identity) {
    const destination = sanitizeClientDestination(`/acceso/blogger/${siteKey}`)
    redirect(`/cliente?redirectedFrom=${destination}`)
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
