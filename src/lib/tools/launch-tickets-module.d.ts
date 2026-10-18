declare module '@/lib/tools/launch-tickets.mjs' {
  export const HANDOFF_PROTOCOL: 'wf-blogger-handoff/v1'

  export type LaunchClaims = {
    siteKey: string
    audience: string
    projectId: string
    clientId: string | null
    userId: string
    actorRole: 'admin' | 'client'
  }

  export type ConsumedLaunchTicket = LaunchClaims & {
    protocol: typeof HANDOFF_PROTOCOL
    expiresAt: string
  }

  type RpcDatabase = Pick<
    import('@supabase/supabase-js').SupabaseClient<import('@/lib/supabase/types').Database>,
    'rpc'
  >

  export function createLaunchTicket(
    db: RpcDatabase,
    input: LaunchClaims,
    options?: { randomBytes?: (size: number) => Buffer },
  ): Promise<{ protocol: typeof HANDOFF_PROTOCOL; code: string; expiresAt: string }>

  export function consumeLaunchTicket(
    db: RpcDatabase,
    input: Pick<LaunchClaims, 'siteKey' | 'audience'> & { code: string },
  ): Promise<ConsumedLaunchTicket | null>

  export function getBloggerExchangeSecret(siteKey: string, env?: NodeJS.ProcessEnv): string | null
  export function isBloggerExchangeAuthorized(authorization: string | null, expectedSecret: string): boolean
  export function renderLaunchForm(input: { action: string; code: string; siteKey: string }): string
  export function buildLaunchSecurityHeaders(formAction?: string): Record<string, string>
}
