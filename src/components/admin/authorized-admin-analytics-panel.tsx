import { AdvancedProjectAnalyticsPanel } from '@/components/admin/advanced-project-analytics-panel'
import {
  AnalyticsTargetUnavailableError,
  resolveAdminAnalyticsTargetForRegistryKey,
} from '@/lib/analytics/project-access'
import { getAnalyticsMarketOptions } from '@/lib/analytics/umami-dashboard.mjs'

export async function AuthorizedAdminAnalyticsPanel({
  registryKey,
  projectLabel,
  domain,
}: {
  registryKey: string
  projectLabel: string
  domain: string
}) {
  try {
    const target = await resolveAdminAnalyticsTargetForRegistryKey(registryKey)
    return (
      <AdvancedProjectAnalyticsPanel
        projectKey={target.projectId}
        projectLabel={projectLabel}
        domain={domain}
        marketOptions={getAnalyticsMarketOptions(target.registryKey)}
      />
    )
  } catch (error) {
    if (error instanceof AnalyticsTargetUnavailableError) return null
    throw error
  }
}
