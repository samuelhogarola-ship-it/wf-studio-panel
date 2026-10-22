import { Suspense } from 'react'

import { AnalyticsSkeleton } from '@/components/admin/analytics-skeleton'
import { AuthorizedAdminAnalyticsPanel } from '@/components/admin/authorized-admin-analytics-panel'
import { PanelAnalyticsSection } from '@/components/admin/panel-analytics-section'
import { AdminShell } from '@/components/layout/app-shell'
import { requireAdmin } from '@/lib/auth'
import { getLocale } from '@/lib/locale'

export default async function Page() {
  const identity = await requireAdmin()
  const locale = await getLocale()
  return (
    <AdminShell
      title="Vokabel-World"
      description="Gestión de apps de vocabulario"
      currentPath="/paneladmin/vokabel-world"
      userEmail={identity.email}
      locale={locale}
    >
      <Suspense fallback={<AnalyticsSkeleton />}>
        <PanelAnalyticsSection panelKey="vokabel-world" />
      </Suspense>
      <AuthorizedAdminAnalyticsPanel registryKey="vokabellab" projectLabel="Vokabel-World" domain="vokabellab.com" />
    </AdminShell>
  )
}
