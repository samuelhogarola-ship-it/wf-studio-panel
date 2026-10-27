import { getOptionalIdentity } from '@/lib/auth'
import { getBloggerSite } from '@/lib/blogger/sites.mjs'
import { getBloggerCapabilityIssue } from '@/lib/projects/blogger-validation'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

const canonicalDomain = (domain: string) => domain.toLowerCase().replace(/^www\./, '')

function denied() {
  return Object.assign(new Error('No tienes acceso a este Blogger.'), { status: 403 })
}

export async function authorizeBloggerSite(
  siteKey: string,
  options: { allowedRoles?: Array<'client' | 'admin'> } = {},
) {
  const identity = await getOptionalIdentity()
  if (!identity) throw Object.assign(new Error('Inicia sesión para usar Blogger.'), { status: 401 })
  const site = getBloggerSite(siteKey)
  const allowedRoles = site.site.blogger.runtime === 'central-legacy'
    ? ['admin']
    : (options.allowedRoles ?? ['client', 'admin'])
  if ((identity.role !== 'client' && identity.role !== 'admin') || !allowedRoles.includes(identity.role)) throw denied()

  const db = getSupabaseAdminClient()
  let clientId: string | null = null
  if (identity.role === 'client') {
    const { data: client } = await db.from('clients').select('id').eq('project', 'wf-studio')
      .eq('status', 'active').ilike('email', identity.email.trim().toLowerCase()).maybeSingle()
    if (!client) throw denied()
    clientId = client.id
  }

  let projectQuery = db.from('client_projects').select('id, client_id, slug, domain')
    .eq('slug', siteKey).eq('status', 'active')
  if (clientId) projectQuery = projectQuery.eq('client_id', clientId).eq('client_access_enabled', true)
  const { data: project } = await projectQuery.maybeSingle()
  if (!project || canonicalDomain(project.domain) !== canonicalDomain(site.site.domain)) throw denied()

  const { data: capability } = await db.from('project_capabilities')
    .select('id, capability_key, state, launch_url, validated_at, metadata').eq('project_id', project.id)
    .eq('capability_key', 'blogger').eq('state', 'active').maybeSingle()
  if (!capability || getBloggerCapabilityIssue(project, capability, site.site)) throw denied()

  return { identity, project, ...site }
}
