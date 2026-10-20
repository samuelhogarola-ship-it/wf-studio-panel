import Link from 'next/link'
import { AdminShell } from '@/components/layout/app-shell'
import { Card } from '@/components/ui/card'
import { ProjectForm } from '@/components/admin/project-form'
import { ProjectFilters } from '@/components/admin/project-filters'
import { ProjectFavoriteForm } from '@/components/admin/project-favorite-form'
import { ProjectToolGrid, projectWorkspaceLabels } from '@/components/admin/project-tool-grid'
import { Badge } from '@/components/ui/badge'
import { requireAdmin } from '@/lib/auth'
import { getAdminProjects, isAdminProjectFavorite } from '@/lib/data/projects'
import { getLocale } from '@/lib/locale'
import { projectTranslations } from '@/lib/i18n'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const identity = await requireAdmin()
  const locale = await getLocale()
  const copy = projectTranslations[locale]
  const workspaceCopy = projectWorkspaceLabels[locale]
  const params = await searchParams
  const value = (key: string) => typeof params[key] === 'string' ? params[key] as string : ''
  const filters = { q: value('q'), client: value('client'), status: value('status'), capability: value('capability') }
  const { projects, clients } = await getAdminProjects({ query: filters.q, clientId: filters.client, status: filters.status, capability: filters.capability })
  const favoriteStates = new Map(await Promise.all(projects.map(async project => [project.id, await isAdminProjectFavorite(identity.userId, project.id)] as const)))
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
          {projects.map(project => <Card key={project.id} className="grid gap-4 p-5" data-project={project.id}>
            <div>
              <h2 className="text-xl font-bold"><Link href={`/paneladmin/proyectos/${project.id}`} className="text-brand underline">{project.name}</Link></h2>
              <p>{project.domain}</p>
            </div>
            <p className="text-sm text-muted">{copy.client}: {project.client?.name ?? copy.unassigned} · {copy.hosting}: {project.hosting_label ?? '—'}</p>
            <p className="text-sm">{copy.statusLabels[project.status]} · {project.client_access_enabled ? copy.enabled : copy.disabled} · {project.client?.portal_mode ?? 'legacy'}</p>
            <div className="flex flex-wrap gap-2">
              {project.capabilities.map(capability => <Badge key={capability.id} data-capability-badge={capability.capability_key} data-state={capability.state}>
                {copy.capabilities[capability.capability_key]} · {copy.states[capability.state]}
              </Badge>)}
            </div>
            <ProjectToolGrid project={project} locale={locale} compact />
            {project.warnings.length ? <ul className="grid gap-1 text-xs text-amber-800">{project.warnings.map(warning => <li key={warning}>{copy.warnings[warning]}</li>)}</ul> : null}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <Link href={`/paneladmin/proyectos/${project.id}`} className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-white">{workspaceCopy.openProject}</Link>
              <ProjectFavoriteForm projectId={project.id} isFavorite={favoriteStates.get(project.id) ?? false} />
            </div>
          </Card>)}
        </div>
        {!projects.length ? <p className="text-muted">{copy.empty}</p> : null}
        <ProjectForm locale={locale} />
        <Link href="/paneladmin/clientes" className="text-brand underline">{copy.invite}</Link>
      </div>
    </AdminShell>
  )
}
