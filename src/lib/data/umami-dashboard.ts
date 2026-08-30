import 'server-only'

import { unstable_cache } from 'next/cache'

import {
  fetchAllUmamiPanelData,
  getConfiguredUmamiSites,
  getPanelUmamiSites,
  getTrailingComparisonRange,
  getUmamiConnections,
  type UmamiPanelKey,
  type UmamiSiteReport,
} from '@/lib/analytics/umami-core.mjs'

const getCachedAnalytics = unstable_cache(
  async (): Promise<UmamiSiteReport[]> => {
    const sites = getConfiguredUmamiSites(process.env)

    return fetchAllUmamiPanelData({
      connections: getUmamiConnections(process.env),
      sites,
      range: getTrailingComparisonRange(new Date(), 30),
    })
  },
  ['umami-dashboard-v1'],
  { revalidate: 300 },
)

const getCachedPanelAnalytics = unstable_cache(
  async (panelKey: UmamiPanelKey): Promise<UmamiSiteReport[]> => {
    const sites = getPanelUmamiSites(
      panelKey,
      getConfiguredUmamiSites(process.env),
    )

    return fetchAllUmamiPanelData({
      connections: getUmamiConnections(process.env),
      sites,
      range: getTrailingComparisonRange(new Date(), 30),
    })
  },
  ['umami-panel-dashboard-v2'],
  { revalidate: 300 },
)

export async function getAllAnalytics(): Promise<UmamiSiteReport[]> {
  return getCachedAnalytics()
}

export async function getPanelAnalytics(
  panelKey: UmamiPanelKey,
): Promise<UmamiSiteReport[]> {
  return getCachedPanelAnalytics(panelKey)
}
