declare module '@/lib/analytics/umami-view-model.mjs' {
  import type { UmamiSite, UmamiSiteReport } from '@/lib/analytics/umami-core.mjs'

  export type AnalyticsMetricSet = {
    visitors: number
    visits: number
    pageviews: number
    bounceRate: number
    averageDuration: number
  }

  export type AnalyticsView =
    | {
        status: 'unavailable'
        availableSites: 0
        unavailableSites: Array<{
          site: UmamiSite
          status: 'missing_connection' | 'missing_website_id' | 'error'
          message: string
        }>
      }
    | {
        status: 'ok'
        availableSites: number
        unavailableSites: Array<{
          site: UmamiSite
          status: 'missing_connection' | 'missing_website_id' | 'error'
          message: string
        }>
        current: AnalyticsMetricSet
        previous: AnalyticsMetricSet
        comparisons: Record<keyof AnalyticsMetricSet, number | null>
        series: Array<{ x: string; y: number }>
        topPages: Array<{ x: string; y: number }>
        topReferrers: Array<{ x: string; y: number }>
      }

  export function metricValue(metric: unknown): number
  export function buildUmamiAnalyticsView(reports: UmamiSiteReport[]): AnalyticsView
}
