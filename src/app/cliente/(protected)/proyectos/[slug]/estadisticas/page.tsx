import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ProjectAnalyticsPanel } from '@/components/analytics/project-analytics-panel'
import {
  AnalyticsTargetUnavailableError,
  resolveClientAnalyticsTarget,
} from '@/lib/analytics/project-access'
import { getAnalyticsMarketOptions } from '@/lib/analytics/umami-dashboard.mjs'
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
  let target
  try {
    target = await resolveClientAnalyticsTarget(slug)
  } catch (error) {
    if (error instanceof AnalyticsTargetUnavailableError) notFound()
    throw error
  }
  const project = await getAccessibleClientProject(target.projectSlug)
  if (!project) notFound()

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
        projectKey={target.projectSlug}
        projectLabel={project.name}
        domain={project.domain}
        marketOptions={getAnalyticsMarketOptions(target.registryKey)}
      />
    </div>
  )
}
