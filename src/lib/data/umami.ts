import 'server-only'

import { cache } from 'react'

import {
  buildUmamiDashboard,
  getMissingUmamiConfig,
  type AnalyticsDays,
  type UmamiDashboard,
} from '@/lib/data/umami-core.mjs'

export type SuperEntrenadorAnalyticsResult =
  | { status: 'ready'; data: UmamiDashboard }
  | { status: 'not-configured'; missing: string[] }
  | { status: 'error'; message: string }

export const getSuperEntrenadorAnalytics = cache(
  async (days: AnalyticsDays): Promise<SuperEntrenadorAnalyticsResult> => {
    const missing = getMissingUmamiConfig(process.env)
    if (missing.length) return { status: 'not-configured', missing }

    try {
      const data = await buildUmamiDashboard({
        config: {
          baseUrl: process.env.UMAMI_URL!,
          username: process.env.UMAMI_USERNAME!,
          password: process.env.UMAMI_PASSWORD!,
          websiteId: process.env.UMAMI_SUPERENTRENADOR_WEBSITE_ID!,
        },
        days,
      })
      return { status: 'ready', data }
    } catch (error) {
      console.error('[superentrenador/analytics] Umami request failed', error)
      return { status: 'error', message: 'No se pudo conectar con Umami en este momento.' }
    }
  },
)
