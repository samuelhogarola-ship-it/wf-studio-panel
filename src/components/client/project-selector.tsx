import Link from 'next/link'
import { clientPortalTranslations, type Locale } from '@/lib/i18n'

export function ProjectSelector({ projects, locale }: {
  projects: readonly { id: string; slug: string; name: string; domain: string }[]
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
          {projects.map(project => (
            <li key={project.id}>
              <Link href={`/cliente/proyectos/${encodeURIComponent(project.slug)}`} className="block rounded-2xl border border-line bg-white p-6 transition hover:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                <h2 className="font-bold">{project.name}</h2>
                <p className="mt-1 break-all text-sm text-muted">{project.domain}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-4 text-sm font-semibold text-brand">
        <Link href="/cliente/pendientes" className="underline">{text.pending}</Link>
        <Link href="/cliente/mensajeria" className="underline">{text.messages}</Link>
      </div>
    </section>
  )
}
