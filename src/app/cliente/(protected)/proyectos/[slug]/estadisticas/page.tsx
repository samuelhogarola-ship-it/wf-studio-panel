import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ProjectAnalyticsPanel } from '@/components/analytics/project-analytics-panel'
import { getAccessibleClientProject } from '@/lib/data/projects'
import { clientPortalTranslations, projectTranslations } from '@/lib/i18n'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

export default async function ClientProjectStatisticsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const [locale, { slug }] = await Promise.all([getLocale(), params])
  const project = await getAccessibleClientProject(slug)
  const activeAnalytics = project?.capabilities.some(capability =>
    capability.capability_key === 'analytics' && capability.state === 'active')
  if (!project || !activeAnalytics) notFound()

  const clientText = clientPortalTranslations[locale]
  const analyticsLabel = projectTranslations[locale].capabilities.analytics

  return (
    <div className="space-y-6">
      <header>
        <Link href={`/cliente/proyectos/${encodeURIComponent(project.slug)}`} className="text-sm font-semibold text-brand underline">
          {locale === 'en' ? 'Back to project' : 'Volver al proyecto'}
        </Link>
        <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-muted">{clientText.overview}</p>
        <h1 className="mt-1 text-2xl font-black">{analyticsLabel} · {project.name}</h1>
        <p className="mt-1 break-all text-muted">{project.domain}</p>
      </header>

      <ProjectAnalyticsPanel
        projectKey={project.slug}
        projectLabel={project.name}
        domain={project.domain}
      />
    </div>
  )
}
