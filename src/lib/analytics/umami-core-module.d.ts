declare module '@/lib/analytics/umami-core.mjs' {
  export type UmamiSourceKey = 'personal' | 'agama'

  export type UmamiPanelKey =
    | 'wf-studio'
    | 'vivir'
    | 'conoce'
    | 'samuel-coach'
    | 'vokabel-world'
    | 'superentrenador'
    | 'todoplastico'
    | 'reports-only'

  export type UmamiSite = {
    key: string
    label: string
    domain: string
    source: UmamiSourceKey
    panelKey: UmamiPanelKey
    websiteId?: string
  }

  export type UmamiConnection = {
    source: UmamiSourceKey
    baseUrl?: string
    username: string
    password?: string
  }

  export type UmamiRange = {
    days: number
    startAt: number
    endAt: number
    previousStartAt: number
    previousEndAt: number
  }

  export type UmamiMetric = { x: string; y: number }
  export type UmamiStats = Record<string, number | { value: number; prev?: number } | undefined>
  export type UmamiSeries = {
    pageviews?: UmamiMetric[]
    sessions?: UmamiMetric[]
  }

  export type UmamiSiteReport =
    | {
        site: UmamiSite
        status: 'ok'
        stats: UmamiStats
        previousStats: UmamiStats
        series: UmamiSeries
        topPages: UmamiMetric[]
        topReferrers: UmamiMetric[]
        topCountries: UmamiMetric[]
        devices: UmamiMetric[]
      }
    | {
        site: UmamiSite
        status: 'missing_connection' | 'missing_website_id' | 'error'
        message: string
      }

  export function getConfiguredUmamiSites(env?: NodeJS.ProcessEnv | Record<string, string | undefined>): UmamiSite[]
  export function getPanelUmamiSites(panelKey: UmamiPanelKey, sites?: UmamiSite[]): UmamiSite[]
  export function getUmamiConnections(
    env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
  ): Record<UmamiSourceKey, UmamiConnection>
  export function getTrailingComparisonRange(now?: Date, days?: number): UmamiRange
  export function getUmamiToken(options: {
    connection: UmamiConnection
    fetchImpl?: typeof fetch
    requestTimeoutMs?: number
  }): Promise<string>
  export function resolveUmamiSites(options: {
    connection: UmamiConnection
    token: string
    sites: UmamiSite[]
    fetchImpl?: typeof fetch
    requestTimeoutMs?: number
  }): Promise<UmamiSite[]>
  export function fetchUmamiSiteData(options: {
    connection: UmamiConnection
    token: string
    site: UmamiSite
    range: UmamiRange
    fetchImpl?: typeof fetch
    requestTimeoutMs?: number
  }): Promise<UmamiSiteReport>
  export function fetchUmamiPanelData(options: {
    connection: UmamiConnection
    sites: UmamiSite[]
    range: UmamiRange
    fetchImpl?: typeof fetch
    requestTimeoutMs?: number
  }): Promise<UmamiSiteReport[]>
  export function fetchAllUmamiPanelData(options: {
    connections: Record<UmamiSourceKey, UmamiConnection>
    sites: UmamiSite[]
    range: UmamiRange
    fetchImpl?: typeof fetch
    requestTimeoutMs?: number
  }): Promise<UmamiSiteReport[]>
}
