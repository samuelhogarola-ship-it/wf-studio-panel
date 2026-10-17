declare module '@/lib/projects/model.mjs' {
  /** Validates without modifying the destination. Defaults to production policy. */
  export function validateProjectDestination(
    rawUrl: unknown,
    canonicalDomain: unknown,
    production?: boolean,
  ): boolean;
}
