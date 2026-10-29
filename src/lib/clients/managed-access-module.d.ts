declare module '@/lib/clients/managed-access.mjs' {
  export type ManagedClient = { email: string; status: string; project: string }
  export type ManagedProfile = { id: string; email: string | null; role: string }
  export type ManagedAccessResolution =
    | { status: 'missing' }
    | { status: 'ready'; authUserId: string }
    | { status: 'blocked'; reason: string }

  export function generateTemporaryPassword(randomBytes?: (size: number) => Buffer): string
  export function resolveManagedAccess(input: {
    client: ManagedClient | null
    profile: ManagedProfile | null
  }): ManagedAccessResolution
}
