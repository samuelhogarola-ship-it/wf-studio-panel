declare module '@/lib/cron/monthly-stat-reports.mjs' {
  export type StatReportSite = {
    key: string
    label: string
    domain: string
    websiteId?: string
    source: 'personal' | 'agama'
    panelKey: import('@/lib/analytics/umami-core.mjs').UmamiPanelKey
  }

  export function isAuthorizedCronRequest(options: {
    configuredSecret?: string
    authorization?: string | null
    headerSecret?: string | null
  }): boolean

  export function getConfiguredReportSites(env?: NodeJS.ProcessEnv): StatReportSite[]

  export function isAuthorizedMonthlyCronRequest(options: {
    cronSecret?: string
    monthlySecret?: string
    authorization?: string | null
    headerSecret?: string | null
  }): boolean

  export function getMonthlyStatReportConfig(env?: NodeJS.ProcessEnv): {
    reportTo: string
  }

  export function deliverMonthlyStatReport(options: {
    monthKey: string
    emailTo: string
    claimToken: string
    claimDelivery: (input: { monthKey: string; emailTo: string; claimToken: string }) => Promise<{ label: string; markdown: string } | null>
    send: (snapshot: { label: string; markdown: string }) => Promise<{ id?: string } | null>
    completeDelivery: (input: { monthKey: string; claimToken: string; sentAt: string; messageId: string | null }) => Promise<void>
    releaseDelivery: (input: { monthKey: string; claimToken: string; error: string }) => Promise<void>
  }): Promise<{ sent: boolean }>

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
    range: { monthKey: string; label: string; startAt: number; endAt: number; previousStartAt: number; previousEndAt: number; days: number }
  }): Promise<unknown>

  export function processMonthlyStatReport(options: {
    now?: Date
    sites: StatReportSite[]
    fetchSiteSummary?: (context: {
      site: StatReportSite
      range: { monthKey: string; label: string; startAt: number; endAt: number; previousStartAt: number; previousEndAt: number; days: number }
    }) => Promise<unknown>
    fetchSiteReports?: (context: {
      sites: StatReportSite[]
      range: { monthKey: string; label: string; startAt: number; endAt: number; previousStartAt: number; previousEndAt: number; days: number }
    }) => Promise<unknown[]>
    saveReport: (report: {
      monthKey: string
      label: string
      markdown: string
      siteReports: import('@/lib/supabase/types').Json
      generatedAt: string
      complete: boolean
    }) => Promise<string | { storageRef: string; preserved?: boolean; alreadySent?: boolean }>
    sendReport?: (email: {
      to: string
      subject: string
      markdown: string
      storageRef: string
      monthKey: string
      idempotencyKey: string
    }) => Promise<void | { sent: boolean }>
    reportTo?: string
  }): Promise<{
    generated: boolean
    complete: boolean
    sent: boolean
    deliverySatisfied: boolean
    alreadySent: boolean
    deliverySkippedReason?: 'incomplete_site_reports'
    storageRef: string
    monthKey: string
    siteReports: unknown[]
  }>
}
