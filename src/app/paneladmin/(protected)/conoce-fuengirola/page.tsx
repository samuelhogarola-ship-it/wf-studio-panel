import { Suspense } from 'react'

import { AnalyticsSkeleton } from '@/components/admin/analytics-skeleton'
import { AuthorizedAdminAnalyticsPanel } from '@/components/admin/authorized-admin-analytics-panel'
import { PanelAnalyticsSection } from '@/components/admin/panel-analytics-section'
import { PlatformSectionNav } from '@/components/admin/platform-section-nav'
import { AdminShell } from '@/components/layout/app-shell'
import { requireAdmin } from '@/lib/auth'
import { getLocale } from '@/lib/locale'
import { getPendingPlatformRequestCounts } from '@/lib/platform-requests/admin'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [identity, locale, counts] = await Promise.all([requireAdmin(), getLocale(), getPendingPlatformRequestCounts()])

  return (
    <AdminShell
      title="Conoce Fuengirola"
      description="Actividad del portal turístico"
      currentPath="/paneladmin/conoce-fuengirola"
      userEmail={identity.email}
      locale={locale}
    >
      <PlatformSectionNav section="conoce" currentPath="/paneladmin/conoce-fuengirola" counts={counts} />
      <Suspense fallback={<AnalyticsSkeleton />}>
        <PanelAnalyticsSection panelKey="conoce" />
      </Suspense>
      <AuthorizedAdminAnalyticsPanel registryKey="conocef" projectLabel="Conoce Fuengirola" domain="conocefuengirola.com" />
    </AdminShell>
  )
}
