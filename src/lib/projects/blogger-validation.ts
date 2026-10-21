import { getBloggerEditorTarget } from '@/lib/blogger/editor.mjs'
import { validateBloggerProjectDestination } from '@/lib/projects/model.mjs'
import type { Json } from '@/lib/supabase/types'

type BloggerProject = {
  slug: string
  domain: string
}

type BloggerCapability = {
  launch_url: string | null
  validated_at: string | null
  metadata: Json
}

type BloggerSite = {
  key: string
  domain: string
  blogger?: {
    enabled?: boolean
    runtime?: string
    url?: string
  }
}

const canonicalDomain = (domain: string) => domain.toLowerCase().replace(/^www\./, '')

export function hasProjectBloggerRuntime(project: BloggerProject, site: BloggerSite | null): boolean {
  return Boolean(site &&
    site.key === project.slug &&
    canonicalDomain(site.domain) === canonicalDomain(project.domain) &&
    site.blogger?.enabled === true &&
    getBloggerEditorTarget(site))
}

export function getBloggerCapabilityIssue(
  project: BloggerProject,
  capability: BloggerCapability,
  site: BloggerSite | null,
): 'destination' | 'blogger' | null {
  if (capability.launch_url && !validateBloggerProjectDestination(capability.launch_url, project.domain, project.slug)) {
    return 'destination'
  }
  const metadata = capability.metadata
  const provisioningConfirmed = metadata && typeof metadata === 'object' && !Array.isArray(metadata) && metadata.provisioning_confirmed === true
  if (!capability.launch_url || !capability.validated_at || !provisioningConfirmed || !hasProjectBloggerRuntime(project, site)) {
    return 'blogger'
  }
  return null
}
