export interface TurnstileEnvironment {
  NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string
  TURNSTILE_SITE_KEY?: string
  TURNSTILE_SECRET_KEY?: string
}

export interface TurnstileConfig {
  enabled: boolean
  siteKey: string
  secretKey: string
}

export function getTurnstileConfig(
  env?: TurnstileEnvironment,
): TurnstileConfig

export function createContactRateLimiter(options?: {
  limit?: number
  windowMs?: number
  now?: () => number
}): { allow(key: string): boolean }
