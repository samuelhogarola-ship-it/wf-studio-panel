import { NextResponse } from 'next/server'

import { getOptionalIdentity, requireClientAccess } from '@/lib/auth'
import {
  createDirectBloggerSession,
  DIRECT_BLOGGER_COOKIE,
  loadDirectBloggerSessionConfig,
} from '@/lib/blogger/direct-access.mjs'
import { getAccessibleClientProject, getActiveClientCapability } from '@/lib/data/projects'
import { validateProjectDestination } from '@/lib/projects/model.mjs'
import { isTrustedInternalRequestOrigin, resolveRequestOrigin } from '@/lib/security/redirects.mjs'
import { getSiteByKey, getBloggerHandoff } from '@/lib/sites/registry.mjs'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  buildLaunchSecurityHeaders,
  buildLaunchRedirectLocation,
  consumeLaunchTicket,
  createLaunchTicket,
} from '@/lib/tools/launch-tickets.mjs'

export const dynamic = 'force-dynamic'

const secureHeaders = {
  ...buildLaunchSecurityHeaders(),
  'Content-Type': 'application/json; charset=utf-8',
}

const PORTAL_ORIGIN = 'https://portal.webfuengirola.com'
const SESSION_TTL_SECONDS = 8 * 60 * 60
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 20
const attempts = new Map<string, { count: number; resetAt: number }>()

function safeJson(body: object, status: number) {
  return NextResponse.json(body, { status, headers: secureHeaders })
}

function canonicalDomain(domain: string) {
  return domain.toLowerCase().replace(/^www\./, '')
}

function isInternalCentralLaunch(site: { blogger?: { enabled?: boolean; runtime?: string } }) {
  return site.blogger?.enabled === true &&
    (site.blogger.runtime === 'central-legacy' || site.blogger.runtime === 'central-multisite')
}

function validInternalAudience(origin: string) {
  return origin === PORTAL_ORIGIN
}

function consumeAttempt(key: string, now = Date.now()) {
  if (attempts.size >= 10_000) {
    for (const [candidate, state] of attempts) if (state.resetAt <= now) attempts.delete(candidate)
  }
  if (attempts.size >= 10_000 && !attempts.has(key)) return false
  const current = attempts.get(key)
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS })
    return true
  }
  if (current.count >= MAX_ATTEMPTS) return false
  current.count += 1
  return true
}

function launchErrorRedirect(origin: string, siteKey: string, retryAfter?: number) {
  const location = new URL(`/cliente/proyectos/${encodeURIComponent(siteKey)}/blogger`, origin)
  location.searchParams.set('error', 'launch')
  const headers = { ...buildLaunchSecurityHeaders(), Location: location.toString() }
  if (retryAfter) Object.assign(headers, { 'Retry-After': String(retryAfter) })
  return new NextResponse(null, {
    status: 303,
    headers,
  })
}

function sameLaunchBinding(
  consumed: Awaited<ReturnType<typeof consumeLaunchTicket>>,
  expected: {
    siteKey: string
    audience: string
    projectId: string
    clientId: string
    userId: string
  },
) {
  return consumed?.siteKey === expected.siteKey &&
    consumed.audience === expected.audience &&
    consumed.projectId === expected.projectId &&
    consumed.clientId === expected.clientId &&
    consumed.userId === expected.userId &&
    consumed.actorRole === 'client'
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
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const rawOrigin = new URL(request.url).origin
  const requestOrigin = resolveRequestOrigin({
    forwardedHost,
    forwardedProto,
    requestOrigin: rawOrigin,
    fallbackOrigin: forwardedHost === null && forwardedProto === null && isTrustedInternalRequestOrigin(rawOrigin)
      ? PORTAL_ORIGIN
      : undefined,
  })
  const origin = request.headers.get('origin')
  if (origin !== requestOrigin) return safeJson({ error: 'forbidden' }, 403)

  const identity = await getOptionalIdentity()
  if (!identity || !['admin', 'client'].includes(identity.role)) {
    return safeJson({ error: 'unauthorized' }, 401)
  }

  const { siteKey } = await params
  let site
  let handoff
  let internalCentral = false
  try {
    site = getSiteByKey(siteKey)
    internalCentral = isInternalCentralLaunch(site)
    handoff = getBloggerHandoff(site)
  } catch {
    return safeJson({ error: 'tool_unavailable' }, 404)
  }
  if (!handoff && !internalCentral) return safeJson({ error: 'tool_unavailable' }, 404)
  if (internalCentral && (identity.role !== 'client' || !validInternalAudience(requestOrigin))) {
    return safeJson({ error: 'tool_unavailable' }, 404)
  }

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
    if (internalCentral) {
      if (!clientId) throw new Error('Missing client binding')
      if (!consumeAttempt(`${identity.userId}:${siteKey}`)) {
        return launchErrorRedirect(requestOrigin, siteKey, 300)
      }
      const database = getSupabaseAdminClient()
      const binding = {
        siteKey,
        audience: requestOrigin,
        projectId: project.id,
        clientId,
        userId: identity.userId,
        actorRole: 'client' as const,
      }
      const ticket = await createLaunchTicket(database, binding)
      const consumed = await consumeLaunchTicket(database, {
        code: ticket.code,
        siteKey,
        audience: requestOrigin,
      })
      if (!sameLaunchBinding(consumed, binding)) throw new Error('Invalid launch binding')

      const { sessionSecret } = loadDirectBloggerSessionConfig(process.env)
      const response = new NextResponse(null, {
        status: 303,
        headers: {
          ...buildLaunchSecurityHeaders(),
          Location: new URL(`/acceso/blogger/${encodeURIComponent(siteKey)}`, requestOrigin).toString(),
        },
      })
      response.cookies.set(DIRECT_BLOGGER_COOKIE, createDirectBloggerSession({
        secret: sessionSecret,
        siteKey,
        subject: { userId: identity.userId, clientId, projectId: project.id },
      }), {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
        maxAge: SESSION_TTL_SECONDS,
      })
      return response
    }

    const target = new URL(handoff!.launchUrl!)
    const ticket = await createLaunchTicket(getSupabaseAdminClient(), {
      siteKey,
      audience: target.origin,
      projectId: project.id,
      clientId,
      userId: identity.userId,
      actorRole: identity.role as 'admin' | 'client',
    })
    const location = buildLaunchRedirectLocation({ destination: handoff!.url, code: ticket.code, siteKey })
    return new NextResponse(null, {
      status: 303,
      headers: {
        ...buildLaunchSecurityHeaders(),
        Location: location,
      },
    })
  } catch {
    if (internalCentral && validInternalAudience(requestOrigin)) return launchErrorRedirect(requestOrigin, siteKey)
    return safeJson({ error: 'launch_unavailable' }, 503)
  }
}
