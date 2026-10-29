declare module '@/lib/analytics/analytics-profile.mjs' {
  export type AnalyticsOption = { key: string; label: string }
  export type AnalyticsEventOption = AnalyticsOption & { category: string }
  export type AnalyticsDimensions = {
    markets: readonly AnalyticsOption[]
    sections: readonly AnalyticsOption[]
    contentLanguages: readonly AnalyticsOption[]
    devices: readonly AnalyticsOption[]
    events: readonly AnalyticsEventOption[]
  }

  export function getAnalyticsMarketOptions(projectKey: string): readonly AnalyticsOption[]
  export function getAnalyticsDimensions(projectKey: string): AnalyticsDimensions
  export function resolveAnalyticsDrilldown(projectKey: string, input?: {
    market?: string
    section?: string
    contentLanguage?: string
    device?: string
    referrer?: string
    event?: string
  }): {
    dimensions: AnalyticsDimensions
    selected: {
      market: AnalyticsOption
      section: AnalyticsOption | null
      contentLanguage: AnalyticsOption | null
      device: AnalyticsOption | null
      referrer: string
      event: AnalyticsEventOption | null
    }
    filters: Record<string, string>
  }
}
