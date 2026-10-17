import { NextResponse } from 'next/server'

import { getOptionalIdentity, requireClientAccess } from '@/lib/auth'
import { getAccessibleClientProject, getActiveClientCapability } from '@/lib/data/projects'
import { validateProjectDestination } from '@/lib/projects/model.mjs'
import { getSiteByKey, getBloggerHandoff } from '@/lib/sites/registry.mjs'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  buildLaunchSecurityHeaders,
  createLaunchTicket,
  renderLaunchForm,
} from '@/lib/tools/launch-tickets.mjs'

export const dynamic = 'force-dynamic'

const secureHeaders = {
  ...buildLaunchSecurityHeaders(),
  'Content-Type': 'application/json; charset=utf-8',
}

function safeJson(body: object, status: number) {
  return NextResponse.json(body, { status, headers: secureHeaders })
}

function canonicalDomain(domain: string) {
  return domain.toLowerCase().replace(/^www\./, '')
}

async function getAdminLaunchProject(siteKey: string) {
  const db = await createSupabaseServerClient()
  const { data: project, error } = await db
    .from('client_projects')
    .select('*')
    .eq('slug', siteKey)
    .eq('status', 'active')
    .maybeSingle()
  if (error || !project) return null
  const { data: capability, error: capabilityError } = await db
    .from('project_capabilities')
    .select('*')
    .eq('project_id', project.id)
    .eq('capability_key', 'blogger')
    .eq('state', 'active')
    .maybeSingle()
  if (
    capabilityError ||
    !capability?.launch_url ||
    !capability.validated_at ||
    !validateProjectDestination(capability.launch_url, project.domain, true)
  ) return null
  return project
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteKey: string }> },
) {
  const requestOrigin = new URL(request.url).origin
  const origin = request.headers.get('origin')
  if (origin !== requestOrigin) return safeJson({ error: 'forbidden' }, 403)

  const identity = await getOptionalIdentity()
  if (!identity || !['admin', 'client'].includes(identity.role)) {
    return safeJson({ error: 'unauthorized' }, 401)
  }

  const { siteKey } = await params
  let site
  let handoff
  try {
    site = getSiteByKey(siteKey)
    handoff = getBloggerHandoff(site)
  } catch {
    return safeJson({ error: 'tool_unavailable' }, 404)
  }
  if (!handoff) return safeJson({ error: 'tool_unavailable' }, 404)

  let project
  let clientId: string | null = null
  if (identity.role === 'client') {
    const clientIdentity = await requireClientAccess()
    if (clientIdentity.userId !== identity.userId) return safeJson({ error: 'unauthorized' }, 401)
    const [accessibleProject, capability] = await Promise.all([
      getAccessibleClientProject(siteKey),
      getActiveClientCapability(siteKey, 'blogger'),
    ])
    if (!accessibleProject || !capability) return safeJson({ error: 'tool_unavailable' }, 404)
    project = accessibleProject
    clientId = clientIdentity.client.id
  } else {
    project = await getAdminLaunchProject(siteKey)
    clientId = project?.client_id ?? null
  }

  if (!project || canonicalDomain(project.domain) !== canonicalDomain(site.domain)) {
    return safeJson({ error: 'tool_unavailable' }, 404)
  }

  try {
    const target = new URL(handoff.launchUrl!)
    const ticket = await createLaunchTicket(getSupabaseAdminClient(), {
      siteKey,
      audience: target.origin,
      projectId: project.id,
      clientId,
      userId: identity.userId,
      actorRole: identity.role as 'admin' | 'client',
    })
    return new NextResponse(renderLaunchForm({ action: target.toString(), code: ticket.code, siteKey }), {
      status: 200,
      headers: {
        ...buildLaunchSecurityHeaders(target.origin),
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch {
    return safeJson({ error: 'launch_unavailable' }, 503)
  }
}
