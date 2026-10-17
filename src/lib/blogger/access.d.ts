declare module '@/lib/blogger/access.mjs' {
  export function canAccessBloggerSite(identity: { userId: string; role: string } | null, siteKey: string, memberships?: Array<{ userId: string; siteKey: string }>): boolean
  export function assertBloggerSiteAccess(identity: { userId: string; role: string } | null, siteKey: string, memberships?: Array<{ userId: string; siteKey: string }>): void
}
