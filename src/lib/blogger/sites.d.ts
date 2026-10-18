declare module '@/lib/blogger/sites.mjs' {
  export function getBloggerSite(siteKey: string): { site: { key: string; name: string; blogger: { publicPostBase: string; contentDir?: string } }; root: string }
}
