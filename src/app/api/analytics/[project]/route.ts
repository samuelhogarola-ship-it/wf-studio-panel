import { NextResponse } from 'next/server'

import {
  fetchUmamiDashboard,
  normalizePeriod,
  toClientAnalyticsPayload,
  toPublicAnalyticsError,
} from '@/lib/analytics/umami-dashboard.mjs'
import {
  resolveAdminAnalyticsTarget,
  resolveClientAnalyticsTarget,
} from '@/lib/analytics/project-access'
import { getOptionalIdentity } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ project: string }> },
) {
  const identity = await getOptionalIdentity()
  if (!identity || !['admin', 'client'].includes(identity.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { project } = await params
  const url = new URL(request.url)
  const period = normalizePeriod(url.searchParams.get('period') || undefined)
  const summaryOnly = url.searchParams.get('summary') === '1'

  try {
    const target = identity.role === 'admin'
      ? await resolveAdminAnalyticsTarget(project)
      : await resolveClientAnalyticsTarget(project)

    const dashboard = await fetchUmamiDashboard({ projectKey: target.registryKey, period, summaryOnly })
    return NextResponse.json(identity.role === 'client' ? toClientAnalyticsPayload(dashboard) : dashboard, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    })
  } catch (error) {
    if (identity.role === 'admin') {
      const message = error instanceof Error ? error.message : 'No se pudo consultar Umami.'
      const status = message.startsWith('Proyecto de estadísticas desconocido') ? 404 : 502
      return NextResponse.json({ status: 'error', message }, { status })
    }

    const publicError = toPublicAnalyticsError(error)
    return NextResponse.json(
      { status: 'error', message: publicError.message },
      { status: publicError.status },
    )
  }
}
