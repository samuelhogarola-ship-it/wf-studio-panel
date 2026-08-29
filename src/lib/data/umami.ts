import 'server-only'

import {
  buildUmamiDashboard,
  createTtlCache,
  getMissingUmamiConfig,
  type AnalyticsDays,
  type UmamiDashboard,
} from '@/lib/data/umami-core.mjs'

export type SuperEntrenadorAnalyticsResult =
  | { status: 'ready'; data: UmamiDashboard }
  | { status: 'not-configured'; missing: string[] }
  | { status: 'error'; message: string }

const loadCachedDashboard = createTtlCache({ ttlMs: 5 * 60 * 1000 })

export async function getSuperEntrenadorAnalytics(days: AnalyticsDays): Promise<SuperEntrenadorAnalyticsResult> {
  const missing = getMissingUmamiConfig(process.env)
  if (missing.length) return { status: 'not-configured', missing }

  try {
    const data = await loadCachedDashboard(String(days), () =>
      buildUmamiDashboard({
        config: {
          baseUrl: process.env.UMAMI_URL!,
          username: process.env.UMAMI_USERNAME!,
          password: process.env.UMAMI_PASSWORD!,
          websiteId: process.env.UMAMI_SUPERENTRENADOR_WEBSITE_ID!,
        },
        days,
      }),
    )
    return { status: 'ready', data }
  } catch (error) {
    console.error('[superentrenador/analytics] Umami request failed', error)
    return { status: 'error', message: 'No se pudo conectar con Umami en este momento.' }
  }
}
