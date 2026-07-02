declare module '@/lib/security/redirects.mjs' {
  export type ProtectedArea = 'admin' | 'client' | null

  export function sanitizeInternalRedirect(
    next: string | null | undefined,
    options?: {
      fallback?: string
      allowedPrefixes?: string[]
    },
  ): string

  export function buildCanonicalAppUrl(appUrl: string, path?: string): URL

  export function getProtectedArea(pathname: string): ProtectedArea
}
