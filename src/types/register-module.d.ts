declare module '@/lib/auth/register.mjs' {
  export type RegisterPendingClientDependencies = {
    signUp: (input: { email: string; password: string }) => Promise<{
      userId: string | null
      error: { message: string } | null
    }>
    insertClient: (input: {
      id?: string
      name: string
      email: string
      project: 'wf-studio'
      status: 'pending'
    }) => Promise<{
      error: { message: string } | null
    }>
    deleteUser: (userId: string) => Promise<void>
  }

  export function registerPendingClient(input: {
    name: string
    email: string
    password: string
  } & RegisterPendingClientDependencies): Promise<{
    error?: string
    success?: string
  }>
}
