import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ProjectAnalyticsPanel } from '@/components/analytics/project-analytics-panel'
import { AdminShell } from '@/components/layout/app-shell'
import { Card } from '@/components/ui/card'
import {
  AnalyticsTargetUnavailableError,
  resolveAdminAnalyticsTarget,
} from '@/lib/analytics/project-access'
import { requireAdmin } from '@/lib/auth'
import { getAdminProject } from '@/lib/data/projects'
import { projectTranslations } from '@/lib/i18n'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

export default async function AdminProjectStatisticsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const identity = await requireAdmin()
  const [{ id }, locale] = await Promise.all([params, getLocale()])
  const detail = await getAdminProject(id, locale)
  if (!detail) notFound()

  const { project } = detail
  const analyticsLabel = projectTranslations[locale].capabilities.analytics
  let target

  try {
    target = await resolveAdminAnalyticsTarget(project.id)
  } catch (error) {
    if (!(error instanceof AnalyticsTargetUnavailableError)) throw error

    return (
      <AdminShell
        title={`${analyticsLabel} · ${project.name}`}
        description={project.domain}
        currentPath="/paneladmin/proyectos"
        userEmail={identity.email}
        locale={locale}
      >
        <div className="grid gap-6">
          <Link href={`/paneladmin/proyectos/${encodeURIComponent(project.id)}`} className="text-brand underline">
            ← {locale === 'en' ? 'Back to project' : 'Volver al proyecto'}
          </Link>
          <Card className="border-amber-200 bg-amber-50 p-6 text-amber-950" role="status">
            <h2 className="text-lg font-bold">
              {locale === 'en' ? 'Statistics configuration incomplete' : 'Configuración de estadísticas incompleta'}
            </h2>
            <p className="mt-2 text-sm">
              {locale === 'en'
                ? 'Review this project’s analytics capability and registry binding before opening statistics.'
                : 'Revisa la capacidad de analítica y el registro de este proyecto antes de abrir las estadísticas.'}
            </p>
          </Card>
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell
      title={`${analyticsLabel} · ${project.name}`}
      description={project.domain}
      currentPath="/paneladmin/proyectos"
      userEmail={identity.email}
      locale={locale}
    >
      <div className="grid gap-6">
        <Link href={`/paneladmin/proyectos/${encodeURIComponent(project.id)}`} className="text-brand underline">
          ← {locale === 'en' ? 'Back to project' : 'Volver al proyecto'}
        </Link>
        <ProjectAnalyticsPanel
          projectKey={target.projectId}
          projectLabel={project.name}
          domain={project.domain}
        />
      </div>
    </AdminShell>
  )
}
