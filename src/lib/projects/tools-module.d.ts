declare module '@/lib/projects/tools.mjs' {
  import type { ProjectWithCapabilities } from '@/lib/data/projects'
  import type { ProductTier } from '@/lib/supabase/types'

  export type ProjectTool = Readonly<{
    id: 'website' | 'blogger' | 'analytics' | 'client' | 'domains' | 'hosting' | 'invoices' | 'reports' | 'bonuses'
    label: string
    href: string | null
    state: 'active' | 'available' | 'unavailable' | 'misconfigured'
    audience: 'admin' | 'client' | 'both'
    warning?: string
  }>

  export function buildProjectTools(input: {
    project: ProjectWithCapabilities
    viewer: 'admin' | 'client'
    configurationIssues?: Readonly<Record<string, string>>
    bloggerRuntime?: string | null
  }): readonly ProjectTool[]

  export function productTierLabel(tier: ProductTier | null | undefined, locale?: 'es' | 'en'): string
}
