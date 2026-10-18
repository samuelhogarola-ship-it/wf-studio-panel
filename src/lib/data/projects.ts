import 'server-only'

import { z } from 'zod'
import { cache } from 'react'
import { requireAdmin, requireClientAccess } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { CapabilityKey, Tables } from '@/lib/supabase/types'
import { validateBloggerProjectDestination, validateProjectDestination } from '@/lib/projects/model.mjs'
import { buildPortalNavigation } from '@/lib/projects/portal-navigation.mjs'
import { getConfiguredUmamiSites, getUmamiConnections } from '@/lib/analytics/umami-core.mjs'
import type { Locale } from '@/lib/i18n'

export const capabilityKeys: readonly CapabilityKey[] = ['products', 'domains', 'hosting', 'invoices', 'bonuses_reports', 'blogger', 'analytics']
export type Project = Tables<'client_projects'>
export type ProjectCapability = Tables<'project_capabilities'>
export type ProjectClient = Pick<Tables<'clients'>, 'id' | 'name' | 'email' | 'status' | 'project' | 'portal_mode'>
export type ProjectWithCapabilities = Project & { capabilities: ProjectCapability[] }
export type ProjectWarning = 'destination' | 'blogger' | 'analytics' | 'assignment'
type SessionDatabase = Awaited<ReturnType<typeof createSupabaseServerClient>>

const canonicalDomain = (domain: string) => domain.toLowerCase().replace(/^www\./, '')

/** Uses server configuration only; never returns credentials or environment names. */
export function hasProjectAnalytics(project: Project): boolean {
  const site = getConfiguredUmamiSites(process.env).find(site => site.key === project.analytics_registry_key)
  if (!site || !site.websiteId || canonicalDomain(site.domain) !== canonicalDomain(project.domain)) return false
  const connection = getUmamiConnections(process.env)[site.source]
  return Boolean(connection?.baseUrl && connection?.password)
}

export function getCapabilityConfigurationIssue(project: Project, capability: Pick<ProjectCapability, 'capability_key' | 'launch_url' | 'validated_at'>): ProjectWarning | null {
  if (capability.launch_url && !(capability.capability_key === 'blogger'
    ? validateBloggerProjectDestination(capability.launch_url, project.domain, project.slug)
    : validateProjectDestination(capability.launch_url, project.domain, true))) return 'destination'
  if (capability.capability_key === 'hosting' && project.hosting_management_url &&
    !validateProjectDestination(project.hosting_management_url, project.domain, true)) return 'destination'
  if (capability.capability_key === 'blogger' && (!capability.launch_url || !capability.validated_at)) return 'blogger'
  if (capability.capability_key === 'analytics' && !hasProjectAnalytics(project)) return 'analytics'
  return null
}

export function getProjectWarnings(project: ProjectWithCapabilities): ProjectWarning[] {
  const warnings = new Set<ProjectWarning>()
  if (project.client_access_enabled && !project.client_id) warnings.add('assignment')
  if (project.hosting_management_url && !validateProjectDestination(project.hosting_management_url, project.domain, true)) warnings.add('destination')
  if (!hasProjectAnalytics(project)) warnings.add('analytics')
  for (const capability of project.capabilities) {
    if (capability.state === 'unavailable') continue
    const issue = getCapabilityConfigurationIssue(project, capability)
    if (issue) warnings.add(issue)
  }
  return [...warnings]
}

async function loadProjects(db: SessionDatabase, clientId?: string, clientOnly = false): Promise<ProjectWithCapabilities[]> {
  let query = db.from('client_projects').select('*').order('name')
  if (clientId) query = query.eq('client_id', clientId)
  if (clientOnly) query = query.eq('status', 'active').eq('client_access_enabled', true)
  const { data: projects, error } = await query
  if (error) throw new Error('No se pudieron cargar los proyectos.')
  if (!projects?.length) return []
  let capabilitiesQuery = db.from('project_capabilities').select('*').in('project_id', projects.map(project => project.id))
  if (clientOnly) capabilitiesQuery = capabilitiesQuery.eq('state', 'active')
  const { data: capabilities, error: capabilitiesError } = await capabilitiesQuery
  if (capabilitiesError) throw new Error('No se pudieron cargar las capacidades.')
  return projects.map(project => ({ ...project, capabilities: (capabilities ?? []).filter(capability =>
    capability.project_id === project.id && (!clientOnly || !getCapabilityConfigurationIssue(project, capability))) }))
}

async function loadClients(db: SessionDatabase): Promise<ProjectClient[]> {
  const { data, error } = await db.from('clients').select('id, name, email, status, project, portal_mode').eq('project', 'wf-studio').order('name')
  if (error) throw new Error('No se pudieron cargar los clientes.')
  return data ?? []
}

export async function getAdminProjects(filters: { query?: string; clientId?: string; status?: string; capability?: string } = {}) {
  await requireAdmin()
  const db = await createSupabaseServerClient()
  const [projects, clients] = await Promise.all([loadProjects(db), loadClients(db)])
  const query = filters.query?.trim().toLowerCase()
  return {
    clients,
    projects: projects.map(project => ({ ...project, client: clients.find(client => client.id === project.client_id) ?? null, warnings: getProjectWarnings(project) }))
      .filter(project => (!query || [project.name, project.domain, project.slug, project.client?.name, project.client?.email].some(value => value?.toLowerCase().includes(query))) &&
        (!filters.clientId || (filters.clientId === 'unassigned' ? !project.client_id : project.client_id === filters.clientId)) &&
        (!filters.status || project.status === filters.status) &&
        (!filters.capability || project.capabilities.some(capability => capability.capability_key === filters.capability && capability.state === 'active'))),
  }
}

export async function getAdminProject(id: string, locale: Locale = 'es') {
  await requireAdmin()
  if (!z.string().uuid().safeParse(id).success) return null
  const db = await createSupabaseServerClient()
  const { data: row, error } = await db.from('client_projects').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error('No se pudo cargar el proyecto.')
  if (!row) return null
  const [projects, clients, auditResult] = await Promise.all([
    loadProjects(db), loadClients(db),
    db.from('project_capability_audit').select('*').eq('project_id', id).order('created_at', { ascending: false }).limit(100),
  ])
  if (auditResult.error) throw new Error('No se pudo cargar la auditoría.')
  const project = projects.find(project => project.id === id)!
  const client = clients.find(client => client.id === project.client_id) ?? null
  const visible = client?.status === 'active' ? projects.filter(project => project.client_id === client.id && project.status === 'active' && project.client_access_enabled)
    .map(project => ({ ...project, capabilities: project.capabilities.filter(capability => capability.state === 'active' && !getCapabilityConfigurationIssue(project, capability)) })) : []
  return {
    project, clients, client, audit: auditResult.data ?? [], warnings: getProjectWarnings(project),
    preview: {
      projects: visible,
      navigation: client?.status === 'active' ? buildPortalNavigation({ mode: client.portal_mode, projects: visible, locale }) : [],
    },
  }
}

/** Request-scoped only: layout, guards and project resolution share authorized reads. */
const loadClientPortalData = cache(async () => {
  const identity = await requireClientAccess()
  const db = await createSupabaseServerClient()
  const projects = await loadProjects(db, identity.client.id, true)
  const mode = identity.client.portal_mode
  return { ...identity, mode, projects }
})

/** No service role and no caller-supplied client ID: session RLS is authoritative. */
export async function getClientPortalContext(locale: Locale = 'es') {
  const { mode, projects, ...identity } = await loadClientPortalData()
  return { ...identity, mode, projects, navigation: buildPortalNavigation({ mode, projects, locale }) }
}

export async function getAccessibleClientProject(slug: string) {
  const context = await getClientPortalContext()
  return context.projects.find(project => project.slug === slug) ?? null
}

export async function getActiveClientCapability(slug: string, key: CapabilityKey) {
  const project = await getAccessibleClientProject(slug)
  return project?.capabilities.find(capability => capability.capability_key === key && capability.state === 'active') ?? null
}

export async function clientHasActiveCapability(key: CapabilityKey): Promise<boolean> {
  const context = await getClientPortalContext()
  return context.projects.some(project => project.capabilities.some(capability => capability.capability_key === key && capability.state === 'active'))
}
