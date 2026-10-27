declare module '@/lib/blogger/direct-access.mjs' {
  export const DIRECT_BLOGGER_COOKIE: '__Host-wf_sport_blogger'
  export const DIRECT_BLOGGER_SITE_KEY: 'sportmassagefuengirola'
  export const DIRECT_BLOGGER_USERNAME: 'sportmassagefuengirola@gmail.com'

  export function generateDirectBloggerPasswordHash(password: string, options?: { salt?: Buffer }): Promise<string>
  export function verifyDirectBloggerPassword(password: string, encoded: string): Promise<boolean>
  export function loadDirectBloggerConfig(env?: NodeJS.ProcessEnv): {
    username: typeof DIRECT_BLOGGER_USERNAME
    passwordHash: string
    sessionSecret: string
    siteKey: typeof DIRECT_BLOGGER_SITE_KEY
  }
  export function createDirectBloggerSession(options: { secret: string; now?: number; ttlMs?: number }): string
  export function verifyDirectBloggerSession(token: string, options: { secret: string; now?: number }): {
    siteKey: typeof DIRECT_BLOGGER_SITE_KEY
    expiresAt: number
  } | null
}
