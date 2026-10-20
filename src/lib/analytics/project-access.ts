import 'server-only'

import {
  getAccessibleClientProject,
  getAdminProject,
  hasProjectAnalytics,
  type ProjectWithCapabilities,
} from '@/lib/data/projects'

export type AnalyticsTarget = {
  projectId: string
  projectSlug: string
  registryKey: string
}

export class AnalyticsTargetUnavailableError extends Error {
  constructor(identifier: string) {
    super(`Proyecto de estadísticas desconocido: ${identifier}`)
    this.name = 'AnalyticsTargetUnavailableError'
  }
}

function unavailable(identifier: string): never {
  throw new AnalyticsTargetUnavailableError(identifier)
}

function resolveTarget(project: ProjectWithCapabilities | null, identifier: string): AnalyticsTarget {
  const activeAnalytics = project?.capabilities.some(capability =>
    capability.capability_key === 'analytics' && capability.state === 'active')
  if (!project || project.status !== 'active' || !activeAnalytics ||
    !project.analytics_registry_key || !hasProjectAnalytics(project)) {
    return unavailable(identifier)
  }

  return {
    projectId: project.id,
    projectSlug: project.slug,
    registryKey: project.analytics_registry_key,
  }
}

export async function resolveAdminAnalyticsTarget(projectId: string): Promise<AnalyticsTarget> {
  const detail = await getAdminProject(projectId)
  return resolveTarget(detail?.project ?? null, projectId)
}

export async function resolveClientAnalyticsTarget(projectSlug: string): Promise<AnalyticsTarget> {
  const project = await getAccessibleClientProject(projectSlug)
  return resolveTarget(project, projectSlug)
}
