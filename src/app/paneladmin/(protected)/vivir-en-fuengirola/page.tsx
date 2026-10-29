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
      title="Vivir en Fuengirola"
      description="Actividad del portal de residentes"
      currentPath="/paneladmin/vivir-en-fuengirola"
      userEmail={identity.email}
      locale={locale}
    >
      <PlatformSectionNav section="vivir" currentPath="/paneladmin/vivir-en-fuengirola" counts={counts} />
      <Suspense fallback={<AnalyticsSkeleton />}>
        <PanelAnalyticsSection panelKey="vivir" />
      </Suspense>
      <AuthorizedAdminAnalyticsPanel registryKey="vivirenfuengirola" projectLabel="Vivir en Fuengirola" domain="vivirenfuengirola.com" />
    </AdminShell>
  )
}
