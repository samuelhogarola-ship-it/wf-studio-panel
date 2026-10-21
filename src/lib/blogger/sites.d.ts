declare module '@/lib/blogger/sites.mjs' {
  export function getBloggerSite(siteKey: string): {
    site: {
      key: string
      name: string
      domain: string
      productionUrl: string
      blogger: {
        enabled: boolean
        runtime: string
        url: string
        publicPostBase: string
        contentDir?: string
      }
    }
    root: string
  }
  export function resolvePublicPostBase(site: { productionUrl: string; blogger: { publicPostBase: string } }): string
}
