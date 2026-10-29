declare module '@/lib/clients/direct-create.mjs' {
  export type DirectClientCreationResult = { success: string; generatedPassword: string } | { error: string }

  export function createClientWithPassword(input: {
    name: string
    company?: string
    email: string
    phone?: string
    status?: 'active' | 'inactive'
    project: string
    generatePassword: () => string
    createAuthUser: (credentials: { email: string; password: string }) => Promise<{
      userId: string | null
      error: { message: string } | null
    }>
    insertClient: (client: {
      id: string
      name: string
      company: string | null
      email: string
      phone: string | null
      status: 'active' | 'inactive'
      project: string
    }) => Promise<{ error: { message: string } | null }>
    deleteAuthUser: (userId: string) => Promise<unknown>
  }): Promise<DirectClientCreationResult>
}
