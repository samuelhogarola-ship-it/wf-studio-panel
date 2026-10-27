declare module '@/lib/security/mutations.mjs' {
  export function assertTrustedMutation(request: Request, options?: { requireJson?: boolean; fallbackOrigin?: string }): void
}
