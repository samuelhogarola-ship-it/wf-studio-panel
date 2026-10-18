import { NextResponse } from 'next/server'

import {
  fetchUmamiDashboard,
  normalizePeriod,
  toClientAnalyticsPayload,
  toPublicAnalyticsError,
} from '@/lib/analytics/umami-dashboard.mjs'
import { getOptionalIdentity } from '@/lib/auth'
import { getAccessibleClientProject } from '@/lib/data/projects'

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
    let projectKey = project
    if (identity.role === 'client') {
      const clientProject = await getAccessibleClientProject(project)
      const activeAnalytics = clientProject?.capabilities.some(capability =>
        capability.capability_key === 'analytics' && capability.state === 'active')
      if (!clientProject || !activeAnalytics || !clientProject.analytics_registry_key) {
        return NextResponse.json(
          { status: 'error', message: 'Estadísticas no disponibles.' },
          { status: 404 },
        )
      }
      projectKey = clientProject.analytics_registry_key
    }

    const dashboard = await fetchUmamiDashboard({ projectKey, period, summaryOnly })
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
