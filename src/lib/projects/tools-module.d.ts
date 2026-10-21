declare module '@/lib/projects/tools.mjs' {
  import type { ProjectWithCapabilities } from '@/lib/data/projects'

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
  }): readonly ProjectTool[]

  export function generatePublicBloggerEntry(siteKey: string): Readonly<{
    path: '/admin/blogger/'
    target: string
    html: string
  }>
}
