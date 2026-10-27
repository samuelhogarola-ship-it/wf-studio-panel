declare module '@/lib/blogger/direct-access.mjs' {
  export const DIRECT_BLOGGER_COOKIE: '__Host-wf_blogger'
  export const DIRECT_BLOGGER_SITE_KEY: 'sportmassagefuengirola'
  export const DIRECT_BLOGGER_USERNAME: 'sportmassagefuengirola@gmail.com'
  export const DIRECT_BLOGGER_AUDIENCE: 'portal.webfuengirola.com'
  export const DIRECT_BLOGGER_SCOPE: 'blogger:central'

  export type PanelBloggerSubject = { userId: string; clientId: string; projectId: string }

  export function generateDirectBloggerPasswordHash(password: string, options?: { salt?: Buffer }): Promise<string>
  export function verifyDirectBloggerPassword(password: string, encoded: string): Promise<boolean>
  export function loadDirectBloggerConfig(env?: NodeJS.ProcessEnv): {
    username: typeof DIRECT_BLOGGER_USERNAME
    passwordHash: string
    sessionSecret: string
    siteKey: typeof DIRECT_BLOGGER_SITE_KEY
  }
  export function loadDirectBloggerSessionConfig(env?: NodeJS.ProcessEnv): {
    sessionSecret: string
    siteKey: typeof DIRECT_BLOGGER_SITE_KEY
  }
  export function createDirectBloggerSession(options: {
    secret: string
    siteKey?: string
    subject?: PanelBloggerSubject | null
    now?: number
    ttlMs?: number
  }): string
  export function verifyDirectBloggerSession(token: string, options: { secret: string; siteKey?: string; now?: number }): {
    siteKey: string
    audience: typeof DIRECT_BLOGGER_AUDIENCE
    scope: typeof DIRECT_BLOGGER_SCOPE
    source: 'direct' | 'panel'
    subject: PanelBloggerSubject | null
    expiresAt: number
  } | null
}
