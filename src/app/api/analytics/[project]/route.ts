import { NextResponse } from 'next/server'

import { fetchUmamiDashboard, normalizePeriod } from '@/lib/analytics/umami-dashboard.mjs'
import { getOptionalIdentity } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ project: string }> },
) {
  const identity = await getOptionalIdentity()
  if (!identity || identity.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { project } = await params
  const url = new URL(request.url)
  const period = normalizePeriod(url.searchParams.get('period') || undefined)
  const summaryOnly = url.searchParams.get('summary') === '1'

  try {
    const dashboard = await fetchUmamiDashboard({ projectKey: project, period, summaryOnly })
    return NextResponse.json(dashboard, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo consultar Umami.'
    const status = message.startsWith('Proyecto de estadísticas desconocido') ? 404 : 502
    return NextResponse.json({ status: 'error', message }, { status })
  }
}
