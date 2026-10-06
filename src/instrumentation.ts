const ONE_HOUR_MS = 60 * 60 * 1000

let schedulerStarted = false
let lastFiredMonth = ''

function shouldRunMonthlyReport(now: Date): boolean {
  if (now.getUTCDate() !== 1 || now.getUTCHours() < 7 || now.getUTCHours() >= 8) return false
  const key = `${now.getUTCFullYear()}-${now.getUTCMonth()}`
  if (key === lastFiredMonth) return false
  lastFiredMonth = key
  return true
}

async function triggerMonthlyReport() {
  const cronSecret = process.env.CRON_SECRET || process.env.MONTHLY_STAT_REPORTS_CRON_SECRET
  if (!cronSecret) return

  const baseUrl = process.env.APP_URL || 'http://localhost:3000'
  const url = `${baseUrl}/api/monthly-stat-reports`

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cronSecret}` },
    })
    const body = await res.json().catch(() => null)
    console.log(`[monthly-scheduler] ${res.status}`, body?.ok ? 'report sent' : body?.error || 'unknown')
  } catch (err) {
    console.error('[monthly-scheduler] fetch failed:', err instanceof Error ? err.message : err)
  }
}

function startScheduler() {
  if (schedulerStarted) return
  schedulerStarted = true

  console.log('[monthly-scheduler] started — checks hourly, fires on 1st of month at 07:00 UTC')

  setInterval(() => {
    if (shouldRunMonthlyReport(new Date())) {
      triggerMonthlyReport()
    }
  }, ONE_HOUR_MS)
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    startScheduler()
  }
}
