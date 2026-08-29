import { NextResponse } from 'next/server'

import {
  fetchUmamiSiteSummary,
  getConfiguredReportSites,
  getUmamiToken,
  isAuthorizedCronRequest,
  processMonthlyStatReport,
  resolveReportSites,
  writeMonthlyStatReportFile,
} from '@/lib/cron/monthly-stat-reports.mjs'
import { sendMonthlyStatReportEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

function getCronSecret() {
  return process.env.MONTHLY_STAT_REPORTS_CRON_SECRET || process.env.CRON_SECRET
}

function getRequiredConfig() {
  const baseUrl = process.env.STAT_REPORT_UMAMI_URL
  const username = process.env.STAT_REPORT_UMAMI_USERNAME || 'admin'
  const password = process.env.STAT_REPORT_UMAMI_PASSWORD

  if (!baseUrl || !password) {
    return {
      error: NextResponse.json({
        error: 'stat_report_not_configured',
        message: 'STAT_REPORT_UMAMI_URL and STAT_REPORT_UMAMI_PASSWORD are required.',
      }, { status: 503 }),
    }
  }

  return {
    config: {
      baseUrl,
      username,
      password,
      storageDir: process.env.STAT_REPORT_STORAGE_DIR,
      reportTo: process.env.STAT_REPORT_EMAIL_TO || process.env.RESEND_TO_EMAIL || 'samuel.hogarola@gmail.com',
    },
  }
}

async function runMonthlyStatReport(request: Request) {
  const configuredSecret = getCronSecret()
  if (!configuredSecret) {
    return NextResponse.json({ error: 'cron_not_configured', message: 'Cron secret is required.' }, { status: 503 })
  }

  if (!isAuthorizedCronRequest({
    configuredSecret,
    authorization: request.headers.get('authorization'),
    headerSecret: request.headers.get('x-cron-secret'),
  })) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const setup = getRequiredConfig()
  if ('error' in setup) return setup.error

  const { baseUrl, username, password, storageDir, reportTo } = setup.config
  const token = await getUmamiToken({ baseUrl, username, password })
  const sites = await resolveReportSites({
    baseUrl,
    token,
    sites: getConfiguredReportSites(),
  })

  const result = await processMonthlyStatReport({
    sites,
    fetchSiteSummary: ({ site, range }) => fetchUmamiSiteSummary({ baseUrl, token, site, range }),
    writeReport: ({ monthKey, markdown }) => writeMonthlyStatReportFile({ monthKey, markdown, storageDir }),
    sendReport: async ({ to, subject, markdown, monthKey, idempotencyKey }) => {
      await sendMonthlyStatReportEmail({
        to,
        subject,
        markdown,
        monthKey,
        idempotencyKey,
      })
    },
    reportTo,
  })

  return NextResponse.json({ ok: true, ...result })
}

export async function GET(request: Request) {
  return runMonthlyStatReport(request)
}

export async function POST(request: Request) {
  return runMonthlyStatReport(request)
}
