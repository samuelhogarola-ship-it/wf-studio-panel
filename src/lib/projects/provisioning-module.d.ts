declare module '@/lib/projects/provisioning.mjs' {
  import type { SupabaseClient } from '@supabase/supabase-js'
  import type { Database } from '@/lib/supabase/types'

  export type ProjectRegistration = Readonly<{
    name: string
    slug: string
    domain: string
  }>

  export type ProvisioningResult = Readonly<{
    outcome: 'created' | 'existing'
    project: Database['public']['Tables']['client_projects']['Row']
  }>

  export const PROJECT_CAPABILITY_KEYS: readonly [
    'products',
    'domains',
    'hosting',
    'invoices',
    'bonuses_reports',
    'blogger',
    'analytics',
  ]

  export class ProjectProvisioningError extends Error {
    readonly code: string
    readonly status: number
    constructor(code: string, status?: number)
  }

  export function normalizeProjectRegistration(input: unknown): ProjectRegistration
  export function isProvisioningAuthorized(authorization: string | null, expectedSecret: string): boolean
  export function provisionProject(
    db: SupabaseClient<Database>,
    input: unknown,
  ): Promise<ProvisioningResult>
}
