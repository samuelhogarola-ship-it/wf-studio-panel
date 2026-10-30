import { randomUUID } from 'node:crypto'

import { NextResponse } from 'next/server'

import {
  fetchAllUmamiPanelData,
  getUmamiConnections,
} from '@/lib/analytics/umami-core.mjs'
import {
  deliverMonthlyStatReport,
  getConfiguredReportSites,
  getMonthlyStatReportConfig,
  isAuthorizedMonthlyCronRequest,
  processMonthlyStatReport,
} from '@/lib/cron/monthly-stat-reports.mjs'
import { createMonthlyStatReportRepository } from '@/lib/data/monthly-stat-reports.mjs'
import { sendMonthlyStatReportEmail } from '@/lib/email'
import { getOptionalIdentity } from '@/lib/auth'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getRequiredConfig() {
  try {
    return { config: getMonthlyStatReportConfig(process.env) }
  } catch (error) {
    return {
      error: NextResponse.json({
        error: 'stat_report_not_configured',
        message: error instanceof Error ? error.message : 'Monthly report configuration is incomplete.',
      }, { status: 503 }),
    }
  }
}

function isAuthorizedCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const monthlySecret = process.env.MONTHLY_STAT_REPORTS_CRON_SECRET
  if (!cronSecret && !monthlySecret) {
    return false
  }

  return isAuthorizedMonthlyCronRequest({
    cronSecret,
    monthlySecret,
    authorization: request.headers.get('authorization'),
    headerSecret: request.headers.get('x-cron-secret'),
  })
}

async function runMonthlyStatReport({ deliverEmail }: { deliverEmail: boolean }) {
  const setup = deliverEmail ? getRequiredConfig() : null
  if (setup && 'error' in setup) return setup.error

  const reportTo = setup?.config.reportTo
  const reportRepository = createMonthlyStatReportRepository(createSupabaseAdminClient())
  const sites = getConfiguredReportSites()

  const result = await processMonthlyStatReport({
    sites,
    fetchSiteReports: ({ range }) => fetchAllUmamiPanelData({
      connections: getUmamiConnections(process.env),
      sites,
      range,
    }),
    saveReport: ({ monthKey, label, markdown, siteReports, generatedAt, complete }) => {
      return reportRepository.save({
        monthKey,
        label,
        markdown,
        siteReports,
        generatedAt,
        complete,
      })
    },
    sendReport: deliverEmail ? async ({ to, monthKey, idempotencyKey }) => {
      const claimToken = randomUUID()
      return deliverMonthlyStatReport({
        monthKey,
        emailTo: to,
        claimToken,
        claimDelivery: (input) => reportRepository.claimDelivery(input),
        send: (claimedSnapshot) => sendMonthlyStatReportEmail({
          to,
          subject: `Informe estadístico mensual - ${claimedSnapshot.label}`,
          markdown: claimedSnapshot.markdown,
          monthKey,
          idempotencyKey,
        }),
        completeDelivery: (input) => reportRepository.completeDelivery(input),
        releaseDelivery: (input) => reportRepository.releaseDelivery(input),
      })
    } : undefined,
    reportTo,
  })

  if (deliverEmail && !result.deliverySatisfied) {
    return NextResponse.json({
      ok: false,
      error: 'incomplete_site_reports',
      ...result,
    }, { status: 503 })
  }

  return NextResponse.json({ ok: true, ...result })
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET && !process.env.MONTHLY_STAT_REPORTS_CRON_SECRET) {
    return NextResponse.json({ error: 'cron_not_configured', message: 'Cron secret is required.' }, { status: 503 })
  }
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return runMonthlyStatReport({ deliverEmail: true })
}

export async function POST(request: Request) {
  const isPanelRequest = request.headers.get('x-wf-report-request') === 'paneladmin'
  if (isPanelRequest) {
    const identity = await getOptionalIdentity()
    if (!identity || identity.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return runMonthlyStatReport({ deliverEmail: false })
  }

  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return runMonthlyStatReport({ deliverEmail: true })
}
