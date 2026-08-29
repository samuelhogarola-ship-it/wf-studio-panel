import { ProjectAnalyticsPanel } from '@/components/analytics/project-analytics-panel'
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
      <ProjectAnalyticsPanel
        projectKey="vokabelworld"
        projectLabel="Vokabel-World"
        domain="vokabellab.com"
      />
    </AdminShell>
  )
}
