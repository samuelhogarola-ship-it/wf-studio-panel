declare module '@/lib/security/redirects.mjs' {
  export type ProtectedArea = 'admin' | 'client' | null

  export function sanitizeInternalRedirect(
    next: string | null | undefined,
    options?: {
      fallback?: string
      allowedPrefixes?: string[]
    },
  ): string

  export function sanitizeClientDestination(value: unknown): string
  export function isDirectBloggerDestination(value: unknown): boolean
  export function buildCanonicalClientDestinationUrl(value: unknown): URL
  export function buildCanonicalClientLoginUrl(value: unknown, error?: unknown): URL
  export function buildCanonicalClientCallbackUrl(value: unknown): URL
  export function buildCanonicalResetCallbackUrl(): URL

  export function buildCanonicalAppUrl(appUrl: string, path?: string): URL

  export function resolveRequestOrigin(input: {
    forwardedHost?: string | null
    forwardedProto?: string | null
    requestOrigin: string
    fallbackOrigin?: string | null
    allowedHosts?: string[]
  }): string
  export function isTrustedInternalRequestOrigin(origin: string | null | undefined): boolean

  export function getProtectedArea(pathname: string): ProtectedArea
}
