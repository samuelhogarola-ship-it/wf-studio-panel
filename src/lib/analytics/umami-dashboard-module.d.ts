declare module '@/lib/analytics/umami-dashboard.mjs' {
  export type AnalyticsPeriod = 'live' | '7d' | '30d' | '90d' | '6m' | '12m'

  export type MetricValue = {
    value: number
    previous: number | null
    change: number | null
    changePercent: number | null
  }

  export type MetricRow = { x: string | null; y: number }
  export type TimeSeriesRow = { x: string; y: number }

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
  }

  export type AnalyticsConfigurationError = {
    status: 'configuration_error'
    project: AnalyticsDashboard['project']
    range: AnalyticsDashboard['range']
    message: string
  }

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
  export function getAnalyticsRange(period?: string, now?: Date): AnalyticsDashboard['range']
  export function getAnalyticsProject(projectKey: string, env?: NodeJS.ProcessEnv): AnalyticsDashboard['project']
  export function fetchUmamiDashboard(options: {
    projectKey: string
    period?: string
    env?: NodeJS.ProcessEnv
    now?: Date
    fetchImpl?: typeof fetch
    timeoutMs?: number
    summaryOnly?: boolean
  }): Promise<AnalyticsDashboard | AnalyticsConfigurationError>
}
