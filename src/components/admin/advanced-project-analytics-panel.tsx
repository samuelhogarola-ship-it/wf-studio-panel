'use client'

import { useState } from 'react'

import { ProjectAnalyticsPanel } from '@/components/analytics/project-analytics-panel'
import type { AnalyticsMarket } from '@/lib/analytics/umami-dashboard.mjs'

export function AdvancedProjectAnalyticsPanel({
  projectKey,
  projectLabel,
  domain,
  marketOptions = [],
}: {
  projectKey: string
  projectLabel: string
  domain: string
  marketOptions?: ReadonlyArray<AnalyticsMarket>
}) {
  const [expanded, setExpanded] = useState(false)

  return expanded ? (
    <div className="mb-8">
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="rounded-full border border-line bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          Cerrar analítica avanzada
        </button>
      </div>
      <ProjectAnalyticsPanel
        projectKey={projectKey}
        projectLabel={projectLabel}
        domain={domain}
        marketOptions={marketOptions}
        sectionId="estadisticas-avanzadas"
      />
    </div>
  ) : (
    <div className="mb-8 flex justify-center">
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="rounded-full border border-black/10 bg-white px-5 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-slate-700 shadow-sm transition hover:border-emerald-700 hover:text-emerald-800"
      >
        Abrir analítica avanzada · en vivo, periodos, eventos y dimensiones
      </button>
    </div>
  )
}
