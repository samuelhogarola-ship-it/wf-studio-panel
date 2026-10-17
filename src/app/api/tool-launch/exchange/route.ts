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

const MAX_BODY_BYTES = 4096

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

function declaredBodyLength(value: string | null) {
  if (value === null) return { valid: true as const, value: null }
  if (!/^\d+$/.test(value)) return { valid: false as const, value: null }
  const length = Number(value)
  if (!Number.isSafeInteger(length)) return { valid: false as const, value: null }
  return { valid: true as const, value: length }
}

async function cancelBody(body: ReadableStream<Uint8Array> | null) {
  if (!body || body.locked) return
  try {
    await body.cancel()
  } catch {
    // The response remains a generic invalid request even if the peer closed first.
  }
}

async function readBoundedJson(request: Request): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const contentLength = declaredBodyLength(request.headers.get('content-length'))
  if (!contentLength.valid || (contentLength.value !== null && contentLength.value > MAX_BODY_BYTES)) {
    await cancelBody(request.body)
    return { ok: false }
  }
  if (!request.body) return { ok: false }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BODY_BYTES) {
        await reader.cancel()
        return { ok: false }
      }
      chunks.push(value)
    }
  } catch {
    try {
      await reader.cancel()
    } catch {
      // Preserve the same non-revealing response for transport failures.
    }
    return { ok: false }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false }
  }
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    await cancelBody(request.body)
    return json({ error: 'invalid_request' }, 400)
  }

  const parsed = await readBoundedJson(request)
  if (!parsed.ok) return json({ error: 'invalid_request' }, 400)
  const input = parsed.value
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
