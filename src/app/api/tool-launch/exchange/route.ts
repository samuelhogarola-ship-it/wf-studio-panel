import { NextResponse } from 'next/server'

import { getSiteByKey, getBloggerHandoff } from '@/lib/sites/registry.mjs'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  buildLaunchSecurityHeaders,
  consumeLaunchTicket,
  getBloggerExchangeSecret,
  HANDOFF_PROTOCOL,
  isBloggerExchangeAuthorized,
} from '@/lib/tools/launch-tickets.mjs'

export const dynamic = 'force-dynamic'

const responseHeaders = {
  ...buildLaunchSecurityHeaders(),
  'Content-Type': 'application/json; charset=utf-8',
}

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: responseHeaders })
}

function validInput(value: unknown): value is { protocol: string; code: string; siteKey: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const input = value as Record<string, unknown>
  return Object.keys(input).every(key => ['protocol', 'code', 'siteKey'].includes(key)) &&
    input.protocol === HANDOFF_PROTOCOL &&
    typeof input.code === 'string' && /^[A-Za-z0-9_-]{43}$/.test(input.code) &&
    typeof input.siteKey === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.siteKey)
}

export async function POST(request: Request) {
  const length = Number(request.headers.get('content-length') ?? '0')
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json') || length > 4096) {
    return json({ error: 'invalid_request' }, 400)
  }

  let input: unknown
  try {
    input = await request.json()
  } catch {
    return json({ error: 'invalid_request' }, 400)
  }
  if (!validInput(input)) return json({ error: 'invalid_request' }, 400)

  let handoff
  try {
    handoff = getBloggerHandoff(getSiteByKey(input.siteKey))
  } catch {
    return json({ error: 'tool_unavailable' }, 404)
  }
  const expectedSecret = getBloggerExchangeSecret(input.siteKey)
  if (!handoff || !expectedSecret) return json({ error: 'tool_unavailable' }, 404)
  if (!isBloggerExchangeAuthorized(request.headers.get('authorization'), expectedSecret)) {
    return json({ error: 'unauthorized' }, 401)
  }

  try {
    const consumed = await consumeLaunchTicket(getSupabaseAdminClient(), {
      code: input.code,
      siteKey: input.siteKey,
      audience: new URL(handoff.launchUrl!).origin,
    })
    if (!consumed) return json({ error: 'invalid_or_expired_ticket' }, 401)
    return json({
      protocol: HANDOFF_PROTOCOL,
      siteKey: consumed.siteKey,
      subject: {
        role: consumed.actorRole,
        userId: consumed.userId,
        clientId: consumed.clientId,
        projectId: consumed.projectId,
      },
    }, 200)
  } catch {
    return json({ error: 'exchange_unavailable' }, 503)
  }
}
