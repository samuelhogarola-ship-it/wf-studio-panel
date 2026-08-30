declare module '@/lib/data/umami-core.mjs' {
  export type AnalyticsDays = 7 | 30 | 90
  export type UmamiMetricValue = number | { value?: number; prev?: number } | null | undefined
  export type UmamiListItem = { x: string; y: number }
  export type DashboardMetric = { value: number; previous: number; trend: string }
  export type UmamiDashboard = {
    days: AnalyticsDays
    generatedAt: string
    summary: {
      pageviews: DashboardMetric
      visitors: DashboardMetric
      visits: DashboardMetric
      bounceRate: DashboardMetric
      averageVisitSeconds: DashboardMetric
    }
    series: { pageviews: UmamiListItem[]; visits: UmamiListItem[] }
    funnel: Record<string, number>
    topPages: UmamiListItem[]
    referrers: UmamiListItem[]
    countries: UmamiListItem[]
    devices: UmamiListItem[]
  }
  export type UmamiConfig = { baseUrl: string; username: string; password: string; websiteId: string }
  export function createTtlCache(options: { ttlMs: number; now?: () => number }): <T>(key: string, load: () => Promise<T>) => Promise<T>
  export function parseAnalyticsDays(value: string | undefined): AnalyticsDays
  export function getMissingUmamiConfig(env: Record<string, string | undefined>): string[]
  export function getSuperEntrenadorUmamiConfig(env: Record<string, string | undefined>): {
    baseUrl?: string
    username?: string
    password?: string
    websiteId?: string
  }
  export function numberValue(metric: UmamiMetricValue): number
  export function previousValue(metric: UmamiMetricValue): number
  export function statsCurrentValue(stats: Record<string, unknown>, name: string): number
  export function statsPreviousValue(stats: Record<string, unknown>, name: string): number
  export function formatTrend(current: number, previous: number): string
  export function buildUmamiDashboard(options: {
    config: UmamiConfig
    days: AnalyticsDays
    now?: Date
    fetchImpl?: typeof fetch
  }): Promise<UmamiDashboard>
}

declare module '../lib/data/umami-core.mjs' {
  export * from '@/lib/data/umami-core.mjs'
}
