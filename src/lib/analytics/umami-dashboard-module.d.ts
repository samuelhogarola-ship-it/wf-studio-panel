declare module '@/lib/analytics/umami-dashboard.mjs' {
  export type AnalyticsPeriod = 'live' | '7d' | '30d' | '90d' | '6m' | '12m'
  export type AnalyticsMarketKey = 'all' | 'spain' | 'mexico' | 'usa' | 'brazil'
  export type AnalyticsMarket = { key: AnalyticsMarketKey; label: string }
  export type AnalyticsOption = { key: string; label: string }
  export type AnalyticsEventOption = AnalyticsOption & { category: string }

  export type MetricValue = {
    value: number
    previous: number | null
    change: number | null
    changePercent: number | null
  }

  export type MetricRow = { x: string | null; y: number }
  export type TimeSeriesRow = { x: string; y: number }
  export type SessionRow = {
    country: string | null
    region: string | null
    city: string | null
    device: string | null
    browser: string | null
    operatingSystem: string | null
    screen: string | null
    language: string | null
    views: number
    visits: number
    firstAt: string | null
    lastAt: string | null
    durationSeconds: number
  }

  export type AnalyticsDashboard = {
    status: 'ok'
    project: {
      key: string
      label: string
      domain: string
      websiteIdEnv: string
      websiteId?: string
    }
    websiteId: string
    market: AnalyticsMarket
    dimensions: {
      markets: ReadonlyArray<AnalyticsOption>
      sections: ReadonlyArray<AnalyticsOption>
      contentLanguages: ReadonlyArray<AnalyticsOption>
      devices: ReadonlyArray<AnalyticsOption>
      events: ReadonlyArray<AnalyticsEventOption>
    }
    selected: {
      market: AnalyticsMarket
      section: AnalyticsOption | null
      contentLanguage: AnalyticsOption | null
      device: AnalyticsOption | null
      referrer: string
      event: AnalyticsEventOption | null
    }
    breakdowns: {
      sections: AnalyticsBreakdownRow[]
      contentLanguages: AnalyticsBreakdownRow[]
      totalPageviews: number | null
    }
    range: {
      key: AnalyticsPeriod
      label: string
      startAt: number
      endAt: number
      unit: string
    }
    generatedAt: string
    activeVisitors: number | null
    summary: Record<string, MetricValue>
    series: { pageviews: TimeSeriesRow[]; visitors: TimeSeriesRow[] }
    metrics: Record<string, MetricRow[]>
    sessions: SessionRow[]
    sessionsAvailable: boolean
  }

  export type AnalyticsBreakdownRow = AnalyticsOption & {
    status: 'ok' | 'unavailable'
    pageviews: number | null
    visitors: number | null
    visits: number | null
    bounceRate: number | null
    pagesPerVisit: number | null
    averageVisitSeconds: number | null
  }

  export type AnalyticsConfigurationError = {
    status: 'configuration_error'
    project: AnalyticsDashboard['project']
    range: AnalyticsDashboard['range']
    message: string
  }

  export type ClientAnalyticsDashboard = Omit<AnalyticsDashboard, 'project' | 'websiteId'>
  export type ClientAnalyticsConfigurationError = Omit<AnalyticsConfigurationError, 'project'>

  export const ANALYTICS_PROJECTS: ReadonlyArray<{
    key: string
    label: string
    domain: string
  }>
  export function createRequestCoordinator(): {
    next(): { signal: AbortSignal; isLatest(): boolean }
    abort(): void
  }
  export function normalizePeriod(period?: string): AnalyticsPeriod
  export function normalizeSessionRows(response: unknown): SessionRow[]
  export function mergeSummaryRefresh<T extends { status: string }>(current: T | null, refresh: T): T
  export function toClientAnalyticsPayload(
    dashboard: AnalyticsDashboard | AnalyticsConfigurationError,
  ): ClientAnalyticsDashboard | ClientAnalyticsConfigurationError
  export function toPublicAnalyticsError(error: unknown): {
    status: 404 | 502
    message: string
  }
  export function getAnalyticsRange(period?: string, now?: Date): AnalyticsDashboard['range']
  export function getAnalyticsProject(projectKey: string, env?: NodeJS.ProcessEnv): AnalyticsDashboard['project']
  export function getAnalyticsMarketOptions(projectKey: string): ReadonlyArray<AnalyticsMarket>
  export function fetchUmamiDashboard(options: {
    projectKey: string
    period?: string
    env?: NodeJS.ProcessEnv
    now?: Date
    fetchImpl?: typeof fetch
    timeoutMs?: number
    summaryOnly?: boolean
    includeContentLanguages?: boolean
    market?: string
    section?: string
    contentLanguage?: string
    device?: string
    referrer?: string
    event?: string
  }): Promise<AnalyticsDashboard | AnalyticsConfigurationError>
}
