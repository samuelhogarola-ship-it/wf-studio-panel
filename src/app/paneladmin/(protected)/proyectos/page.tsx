import Link from 'next/link'
import { AdminShell } from '@/components/layout/app-shell'
import { Card } from '@/components/ui/card'
import { ProjectForm } from '@/components/admin/project-form'
import { ProjectFilters } from '@/components/admin/project-filters'
import { requireAdmin } from '@/lib/auth'
import { getAdminProjects } from '@/lib/data/projects'
import { getLocale } from '@/lib/locale'
import { projectTranslations } from '@/lib/i18n'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const identity = await requireAdmin()
  const locale = await getLocale()
  const copy = projectTranslations[locale]
  const params = await searchParams
  const value = (key: string) => typeof params[key] === 'string' ? params[key] as string : ''
  const filters = { q: value('q'), client: value('client'), status: value('status'), capability: value('capability') }
  const { projects, clients } = await getAdminProjects({ query: filters.q, clientId: filters.client, status: filters.status, capability: filters.capability })
  return (
    <AdminShell
      title={copy.title}
      description={copy.description}
      currentPath="/paneladmin/proyectos"
      userEmail={identity.email}
      locale={locale}
    >
      <div className="grid gap-6">
        <ProjectFilters clients={clients} filters={filters} locale={locale} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map(project => <Card key={project.id} className="grid gap-3 p-5">
            <h2 className="text-xl font-bold"><Link href={`/paneladmin/proyectos/${project.id}`} className="text-brand underline">{project.name}</Link></h2>
            <p>{project.domain}</p>
            <p className="text-sm text-muted">{copy.client}: {project.client?.name ?? copy.unassigned} · {copy.hosting}: {project.hosting_label ?? '—'}</p>
            <p className="text-sm">{copy.statusLabels[project.status]} · {project.client_access_enabled ? copy.enabled : copy.disabled} · {project.client?.portal_mode ?? 'legacy'}</p>
            {project.warnings.length ? <ul className="grid gap-1 text-xs text-amber-800">{project.warnings.map(warning => <li key={warning}>{copy.warnings[warning]}</li>)}</ul> : null}
          </Card>)}
        </div>
        {!projects.length ? <p className="text-muted">{copy.empty}</p> : null}
        <ProjectForm locale={locale} />
        <Link href="/paneladmin/clientes" className="text-brand underline">{copy.invite}</Link>
      </div>
    </AdminShell>
  )
}
