import Link from 'next/link'
import { Suspense } from 'react'

import { AnalyticsSkeleton } from '@/components/admin/analytics-skeleton'
import { AdvancedProjectAnalyticsPanel } from '@/components/admin/advanced-project-analytics-panel'
import { PanelAnalyticsSection } from '@/components/admin/panel-analytics-section'
import { AdminShell } from '@/components/layout/app-shell'
import { requireAdmin } from '@/lib/auth'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const identity = await requireAdmin()
  const locale = await getLocale()

  return (
    <AdminShell
      title="Vivir en Fuengirola"
      description="Actividad del portal de residentes"
      currentPath="/paneladmin/vivir-en-fuengirola"
      userEmail={identity.email}
      locale={locale}
    >
      <div className="mb-6 flex flex-wrap gap-2">
        <ProjectLink href="/paneladmin/vivir-en-fuengirola/clientes" label="Clientes" />
        <ProjectLink href="/paneladmin/vivir-en-fuengirola/suscripciones" label="Suscripciones" />
        <ProjectLink href="/paneladmin/vivir-en-fuengirola/negocios" label="Negocios" />
      </div>
      <Suspense fallback={<AnalyticsSkeleton />}>
        <PanelAnalyticsSection panelKey="vivir" />
      </Suspense>
      <AdvancedProjectAnalyticsPanel projectKey="vivirenfuengirola" projectLabel="Vivir en Fuengirola" domain="vivirenfuengirola.com" />
    </AdminShell>
  )
}

function ProjectLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{label}</Link>
}
