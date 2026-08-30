import { UmamiAnalyticsPanel } from '@/components/admin/umami-analytics-panel'
import type { UmamiPanelKey, UmamiSourceKey } from '@/lib/analytics/umami-core.mjs'
import { getPanelAnalytics } from '@/lib/data/umami-dashboard'

const DEFAULT_SOURCE_URLS: Record<UmamiSourceKey, string> = {
  personal: 'https://analytics.187.124.55.36.sslip.io',
  agama: 'https://analytics.2.24.10.239.sslip.io',
}

export async function PanelAnalyticsSection({ panelKey }: { panelKey: UmamiPanelKey }) {
  const reports = await getPanelAnalytics(panelKey)
  const sourceUrls: Record<UmamiSourceKey, string> = {
    personal:
      process.env.UMAMI_PERSONAL_URL ||
      process.env.STAT_REPORT_UMAMI_URL ||
      DEFAULT_SOURCE_URLS.personal,
    agama: process.env.UMAMI_AGAMA_URL || DEFAULT_SOURCE_URLS.agama,
  }

  return <UmamiAnalyticsPanel reports={reports} sourceUrls={sourceUrls} />
}
