declare module '@/lib/cron/monthly-stat-reports.mjs' {
  export type StatReportSite = {
    key: string
    label: string
    domain: string
    websiteId?: string
  }

  export function isAuthorizedCronRequest(options: {
    configuredSecret?: string
    authorization?: string | null
    headerSecret?: string | null
  }): boolean

  export function getConfiguredReportSites(env?: NodeJS.ProcessEnv): StatReportSite[]

  export function getUmamiToken(options: {
    baseUrl: string
    username: string
    password: string
  }): Promise<string>

  export function resolveReportSites(options: {
    baseUrl: string
    token: string
    sites: StatReportSite[]
  }): Promise<StatReportSite[]>

  export function fetchUmamiSiteSummary(options: {
    baseUrl: string
    token: string
    site: StatReportSite
    range: { monthKey: string; label: string; startAt: number; endAt: number }
  }): Promise<unknown>

  export function writeMonthlyStatReportFile(options: {
    monthKey: string
    markdown: string
    storageDir?: string
  }): Promise<string>

  export function processMonthlyStatReport(options: {
    now?: Date
    sites: StatReportSite[]
    fetchSiteSummary: (context: {
      site: StatReportSite
      range: { monthKey: string; label: string; startAt: number; endAt: number }
    }) => Promise<unknown>
    writeReport: (report: { monthKey: string; markdown: string }) => Promise<string>
    sendReport?: (email: {
      to: string
      subject: string
      markdown: string
      filePath: string
      monthKey: string
      idempotencyKey: string
    }) => Promise<void>
    reportTo?: string
  }): Promise<{
    generated: boolean
    sent: boolean
    filePath: string
    monthKey: string
    siteReports: unknown[]
  }>
}
