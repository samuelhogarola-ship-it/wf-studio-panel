import 'server-only'

import { fetchUmamiDashboard } from '@/lib/analytics/umami-dashboard.mjs'
import { getCapabilityConfigurationIssue, type ProjectWithCapabilities } from '@/lib/data/projects'
import { buildProjectTools } from '@/lib/projects/tools.mjs'

export type ClientAnalyticsSummary = {
  projectSlug: string
  projectName: string
  pageviews: number
  visitors: number
  visits: number
}

type SummaryDashboard = Awaited<ReturnType<typeof fetchUmamiDashboard>>
type SummaryFetcher = (options: { projectKey: string; summaryOnly: true }) => Promise<SummaryDashboard>

type ClientAnalyticsSummaryOptions = {
  fetchDashboard?: SummaryFetcher
}

const publicMetricValue = (value: unknown) => (
  typeof value === 'number' && Number.isFinite(value) ? value : 0
)

export async function getClientAnalyticsSummaries(
  projects: readonly ProjectWithCapabilities[],
  { fetchDashboard = fetchUmamiDashboard }: ClientAnalyticsSummaryOptions = {},
): Promise<ClientAnalyticsSummary[]> {
  const eligibleProjects = projects.filter((project) => {
    const configurationIssues = Object.fromEntries(project.capabilities.flatMap((capability) => {
      const issue = getCapabilityConfigurationIssue(project, capability)
      return issue ? [[capability.capability_key, issue]] : []
    }))
    return Boolean(
      project.analytics_registry_key &&
      buildProjectTools({ project, viewer: 'client', configurationIssues })
        .some((tool) => tool.id === 'analytics'),
    )
  })

  const settled = await Promise.allSettled(eligibleProjects.map(async (project) => {
    const dashboard = await fetchDashboard({
      projectKey: project.analytics_registry_key!,
      summaryOnly: true,
    })
    if (dashboard.status !== 'ok') return null
    return {
      projectSlug: project.slug,
      projectName: project.name,
      pageviews: publicMetricValue(dashboard.summary.pageviews?.value),
      visitors: publicMetricValue(dashboard.summary.visitors?.value),
      visits: publicMetricValue(dashboard.summary.visits?.value),
    }
  }))

  return settled.flatMap((result) => (
    result.status === 'fulfilled' && result.value ? [result.value] : []
  ))
}
