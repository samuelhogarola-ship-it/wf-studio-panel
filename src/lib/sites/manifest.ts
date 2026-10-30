import rawSites from '../../config/sites.json' with { type: 'json' }

export type SiteManifestEntry = {
  schemaVersion: 1
  key: string
  name: string
  domain: string
  productionUrl: string
  panelKey: string
  panel: { key: string; path: string }
  repository?: string
  allowedOrigins?: readonly string[]
  analytics: {
    source: 'personal' | 'agama'
    envSuffix: string
    legacyDashboard: boolean
    legacyKey?: string
    legacyLabel?: string
    properties?: readonly {
      key: string
      label: string
      envSuffix: string
    }[]
    profile?: {
      schemaVersion: 1
      languages: readonly AnalyticsRouteDimension[]
      sections: readonly AnalyticsRouteDimension[]
      allowedEvents: readonly { key: string; label: string; category: string }[]
      allowedContextKeys: readonly string[]
      excludedDestinations: readonly string[]
    }
  }
  blogger: {
    enabled: boolean
    runtime?: 'central-multisite' | 'central-legacy' | 'external'
    customOrigin?: string
    [key: string]: unknown
  }
}

type AnalyticsRouteDimension = {
  key: string
  label: string
  routes: { exact: readonly string[]; prefixes: readonly string[] }
}

type RawSite = Omit<SiteManifestEntry, 'panelKey'>

const entries = (rawSites as readonly RawSite[]).map((site) => ({
  ...site,
  panelKey: site.panel.key,
})) as SiteManifestEntry[]

export const SITE_MANIFEST: readonly SiteManifestEntry[] = Object.freeze(entries.map((site) => Object.freeze(site)))

export function getManifestSites(): readonly SiteManifestEntry[] {
  return SITE_MANIFEST
}

export function getManifestSite(key: string): SiteManifestEntry {
  const site = SITE_MANIFEST.find((entry) => entry.key === key)
  if (!site) throw new Error(`Sitio desconocido: ${key}`)
  return site
}
