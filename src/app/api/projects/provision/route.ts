import { NextResponse } from 'next/server'

import {
  isProvisioningAuthorized,
  normalizeProjectRegistration,
  ProjectProvisioningError,
  provisionProject,
} from '@/lib/projects/provisioning.mjs'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: noStore })
}

export async function POST(request: Request) {
  const secret = process.env.PROJECT_PROVISIONING_SECRET?.trim()
  if (!secret) return json({ error: 'provisioning_not_configured' }, 503)
  if (!isProvisioningAuthorized(request.headers.get('authorization'), secret)) {
    return json({ error: 'unauthorized' }, 401)
  }

  let input: unknown
  try {
    input = normalizeProjectRegistration(await request.json())
  } catch {
    return json({ error: 'invalid_payload' }, 400)
  }

  try {
    const result = await provisionProject(getSupabaseAdminClient(), input)
    const { id, name, slug, domain, status } = result.project
    return json({ outcome: result.outcome, project: { id, name, slug, domain, status } }, result.outcome === 'created' ? 201 : 200)
  } catch (error) {
    if (error instanceof ProjectProvisioningError) {
      if (error.status === 409) return json({ error: error.code }, 409)
      if (error.status === 400) return json({ error: 'invalid_payload' }, 400)
    }
    return json({ error: 'provisioning_failed' }, 500)
  }
}
