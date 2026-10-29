import { NextResponse } from 'next/server'

import {
  fetchUmamiDashboard,
  normalizePeriod,
  toClientAnalyticsPayload,
  toPublicAnalyticsError,
} from '@/lib/analytics/umami-dashboard.mjs'
import { resolveAnalyticsDrilldown } from '@/lib/analytics/analytics-profile.mjs'
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
  const market = url.searchParams.get('market') || 'all'

  try {
    const target = identity.role === 'admin'
      ? await resolveAdminAnalyticsTarget(project)
      : await resolveClientAnalyticsTarget(project)

    const drilldown = resolveAnalyticsDrilldown(target.registryKey, {
      market,
      section: url.searchParams.get('section') || undefined,
      contentLanguage: url.searchParams.get('language') || undefined,
      device: url.searchParams.get('device') || undefined,
      referrer: url.searchParams.get('source') || undefined,
      event: url.searchParams.get('event') || undefined,
    })
    const selected = drilldown.selected
    const dashboard = await fetchUmamiDashboard({
      projectKey: target.registryKey,
      period,
      summaryOnly,
      market: selected.market.key,
      ...(selected.section ? { section: selected.section.key } : {}),
      ...(selected.contentLanguage ? { contentLanguage: selected.contentLanguage.key } : {}),
      ...(selected.device ? { device: selected.device.key } : {}),
      ...(selected.referrer ? { referrer: selected.referrer } : {}),
      ...(selected.event ? { event: selected.event.key } : {}),
    })
    const payload = identity.role === 'client' || dashboard.status === 'ok'
      ? toClientAnalyticsPayload(dashboard)
      : dashboard
    return NextResponse.json(payload, {
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
