declare module '@/lib/clients/direct-create.mjs' {
  export type DirectClientCreationResult = { success: string } | { error: string }

  export function createClientWithPassword(input: {
    name: string
    email: string
    password: string
    project: string
    createAuthUser: (credentials: { email: string; password: string }) => Promise<{
      userId: string | null
      error: { message: string } | null
    }>
    insertClient: (client: {
      id: string
      name: string
      email: string
      status: 'active'
      project: string
    }) => Promise<{ error: { message: string } | null }>
    deleteAuthUser: (userId: string) => Promise<unknown>
  }): Promise<DirectClientCreationResult>
}
