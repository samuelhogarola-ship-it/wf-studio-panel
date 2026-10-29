declare module '@/lib/platform-requests/public-api.mjs' {
  export type PlatformRequestInsert = {
    platform: 'vivir-fuengirola' | 'vivir-fuengirola-negocios' | 'conoce-fuengirola'
    request_type: 'client' | 'business' | 'subscription_interest'
    name: string
    email: string
    phone: string
    company: string
    message: string
    profile_data: Record<string, unknown>
    source_url: string
    fingerprint: string
  }

  export function handlePlatformRequestOptions(request: Request, options?: { env?: NodeJS.ProcessEnv }): Response
  export function handlePlatformRequestConfigGet(request: Request, options?: { env?: NodeJS.ProcessEnv }): Promise<Response>
  export function handlePlatformRequestPost(request: Request, options?: {
    env?: NodeJS.ProcessEnv
    fetchImpl?: typeof fetch
    verifyToken?: (token: string, remoteIp: string | null, secret: string) => Promise<{ success: boolean; hostname?: string }>
    createRequest?: (payload: PlatformRequestInsert) => Promise<'created' | 'existing'>
  }): Promise<Response>
  export function persistPlatformRequest(supabase: unknown, payload: PlatformRequestInsert): Promise<'created' | 'existing'>
}
