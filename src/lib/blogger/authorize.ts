import { getOptionalIdentity } from '@/lib/auth'
import { getDirectBloggerSession } from '@/lib/blogger/direct-access-server'
import { getBloggerSite } from '@/lib/blogger/sites.mjs'
import { getBloggerCapabilityIssue } from '@/lib/projects/blogger-validation'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

const canonicalDomain = (domain: string) => domain.toLowerCase().replace(/^www\./, '')

function denied() {
  return Object.assign(new Error('No tienes acceso a este Blogger.'), { status: 403 })
}

export async function authorizeBloggerSite(siteKey: string) {
  const site = getBloggerSite(siteKey)
  const scopedSession = await getDirectBloggerSession(siteKey)
  const panelSubject = scopedSession?.source === 'panel' ? scopedSession.subject : null
  const identity = panelSubject
    ? { userId: panelSubject.userId, email: '', role: 'client' }
    : await getOptionalIdentity()
  if (!identity) throw Object.assign(new Error('Inicia sesión para usar Blogger.'), { status: 401 })
  if (!['client', 'admin'].includes(identity.role)) throw denied()
  if (identity.role === 'client' && !panelSubject) throw denied()

  const db = getSupabaseAdminClient()
  let clientId: string | null = null
  if (identity.role === 'client') {
    let clientQuery = db.from('clients').select('id').eq('project', 'wf-studio').eq('status', 'active')
    clientQuery = panelSubject
      ? clientQuery.eq('id', panelSubject.clientId)
      : clientQuery.ilike('email', identity.email.trim().toLowerCase())
    const { data: client } = await clientQuery.maybeSingle()
    if (!client) throw denied()
    clientId = client.id
  }

  let projectQuery = db.from('client_projects').select('id, client_id, slug, domain')
    .eq('slug', siteKey).eq('status', 'active')
  if (clientId) projectQuery = projectQuery.eq('client_id', clientId).eq('client_access_enabled', true)
  const { data: project } = await projectQuery.maybeSingle()
  if (!project || canonicalDomain(project.domain) !== canonicalDomain(site.site.domain)) throw denied()
  if (panelSubject && (project.id !== panelSubject.projectId || project.client_id !== panelSubject.clientId)) throw denied()

  const { data: capability } = await db.from('project_capabilities')
    .select('id, capability_key, state, launch_url, validated_at, metadata').eq('project_id', project.id)
    .eq('capability_key', 'blogger').eq('state', 'active').maybeSingle()
  if (!capability || getBloggerCapabilityIssue(project, capability, site.site)) throw denied()

  return { identity, project, ...site }
}
