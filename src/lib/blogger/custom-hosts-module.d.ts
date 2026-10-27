declare module '@/lib/blogger/custom-hosts.mjs' {
  import type { RegisteredSite } from '@/lib/sites/registry.mjs'

  export function createCustomBloggerHostMap(sites: readonly RegisteredSite[]): Map<string, RegisteredSite>
  export function getCustomBloggerOrigin(site: RegisteredSite): string | null
  export function getCustomBloggerSiteByHost(hostname: string): RegisteredSite | null
}
