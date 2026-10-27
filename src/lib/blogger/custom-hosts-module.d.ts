declare module '@/lib/blogger/custom-hosts.mjs' {
  import type { SiteManifestEntry } from '@/lib/sites/manifest'

  export function createCustomBloggerHostMap(sites: readonly SiteManifestEntry[]): Map<string, SiteManifestEntry>
  export function getCustomBloggerOrigin(site: SiteManifestEntry): string | null
  export function getCustomBloggerSiteByHost(hostname: string): SiteManifestEntry | null
}
