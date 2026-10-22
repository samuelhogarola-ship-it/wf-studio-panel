import Link from 'next/link'
import type { ProjectWithCapabilities } from '@/lib/data/projects'
import { clientPortalTranslations, projectTranslations, type Locale } from '@/lib/i18n'
import { buildProjectTools, productTierLabel } from '@/lib/projects/tools.mjs'

export function ProjectSelector({ projects, locale }: {
  projects: readonly ProjectWithCapabilities[]
  locale: Locale
}) {
  const text = clientPortalTranslations[locale]
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">{text.projects}</h1>
        {projects.length > 0 ? <p className="mt-1 text-muted">{text.choose}</p> : null}
      </div>
      {projects.length === 0 ? (
        <div role="status" className="rounded-2xl border border-dashed border-line bg-white p-8">
          <p className="font-semibold">{text.empty}</p>
          <p className="mt-2 text-sm text-muted">{text.emptyDescription}</p>
        </div>
      ) : (
        <ul aria-label={text.choose} className="grid gap-4 sm:grid-cols-2">
          {projects.map(project => {
            const activeTools = buildProjectTools({ project, viewer: 'client' })
              .filter(tool => tool.id === 'analytics' || tool.id === 'blogger')
            return <li key={project.id}>
              <Link href={`/cliente/proyectos/${encodeURIComponent(project.slug)}`} className="block h-full rounded-2xl border border-line bg-white p-6 transition hover:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                <h2 className="font-bold">{project.name}</h2>
                <p className="mt-1 break-all text-sm text-muted">{project.domain}</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">{text.productTier}</p>
                <p className="mt-1 font-semibold">{productTierLabel(project.product_tier, locale)}</p>
                {activeTools.length > 0 ? <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{text.activeTools}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {activeTools.map(tool => <span key={tool.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {tool.id === 'analytics' ? projectTranslations[locale].capabilities.analytics : projectTranslations[locale].capabilities.blogger}
                    </span>)}
                  </div>
                </div> : null}
              </Link>
            </li>
          })}
        </ul>
      )}
      <div className="flex flex-wrap gap-4 text-sm font-semibold text-brand">
        <Link href="/cliente/pendientes" className="underline">{text.pending}</Link>
        <Link href="/cliente/mensajeria" className="underline">{text.messages}</Link>
      </div>
    </section>
  )
}
