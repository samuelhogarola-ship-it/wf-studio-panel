import { getOptionalIdentity } from '@/lib/auth'
import { getBloggerSite } from '@/lib/blogger/sites.mjs'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

export async function authorizeBloggerSite(siteKey: string) {
  const identity = await getOptionalIdentity()
  if (!identity) throw Object.assign(new Error('Inicia sesión para usar Blogger.'), { status: 401 })
  const site = getBloggerSite(siteKey)
  if (identity.role === 'client') {
    const db = getSupabaseAdminClient()
    const { data: client } = await db.from('clients').select('id').eq('project', 'wf-studio')
      .eq('status', 'active').ilike('email', identity.email.trim().toLowerCase()).maybeSingle()
    if (!client) throw Object.assign(new Error('No tienes acceso a este Blogger.'), { status: 403 })
    const { data: project } = await db.from('client_projects').select('id').eq('slug', siteKey)
      .eq('client_id', client.id).eq('status', 'active').eq('client_access_enabled', true).maybeSingle()
    if (!project) throw Object.assign(new Error('No tienes acceso a este Blogger.'), { status: 403 })
    const { data: capability } = await db.from('project_capabilities').select('id').eq('project_id', project.id)
      .eq('capability_key', 'blogger').eq('state', 'active').maybeSingle()
    if (!capability) throw Object.assign(new Error('No tienes acceso a este Blogger.'), { status: 403 })
  } else if (identity.role !== 'admin') {
    throw Object.assign(new Error('No tienes acceso a este Blogger.'), { status: 403 })
  }
  return { identity, ...site }
}
