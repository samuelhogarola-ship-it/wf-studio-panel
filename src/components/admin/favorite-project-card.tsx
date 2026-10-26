import Link from 'next/link'

import { ProjectFavoriteForm } from '@/components/admin/project-favorite-form'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { getCapabilityConfigurationIssue, getProjectBloggerRuntime, type FavoriteProject } from '@/lib/data/projects'
import { buildProjectTools } from '@/lib/projects/tools.mjs'

const statusLabels = {
  draft: 'Borrador',
  active: 'Activo',
  archived: 'Archivado',
} as const

export function FavoriteProjectCard({ project }: { project: FavoriteProject }) {
  const configurationIssues = Object.fromEntries(project.capabilities.flatMap(capability => {
    const issue = getCapabilityConfigurationIssue(project, capability)
    return issue ? [[capability.capability_key, issue]] : []
  }))
  const shortcuts = buildProjectTools({ project, viewer: 'admin', configurationIssues, bloggerRuntime: getProjectBloggerRuntime(project) })
    .filter(tool => ['website', 'blogger', 'analytics'].includes(tool.id) && tool.state === 'active' && tool.href)

  return (
    <Card className="flex h-full flex-col gap-5 p-5" data-project={project.id}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-foreground">{project.name}</h3>
          <p className="mt-1 break-all text-sm text-muted">{project.domain}</p>
        </div>
        <Badge className={project.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
          {statusLabels[project.status]}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {project.client ? <Badge className="bg-sky-50 text-sky-700">{project.client.name}</Badge> : null}
        <Badge className={project.client_access_enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
          {project.client_access_enabled ? 'Acceso habilitado' : 'Acceso deshabilitado'}
        </Badge>
      </div>

      {shortcuts.length ? <div className="flex flex-wrap gap-2">
        {shortcuts.map(tool => tool.id === 'website' ? (
          <a key={tool.id} href={tool.href!} target="_blank" rel="noopener noreferrer" className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">
            {tool.label} ↗
          </a>
        ) : (
          <Link key={tool.id} href={tool.href!} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">
            {tool.label}
          </Link>
        ))}
      </div> : null}

      <div className="mt-auto grid gap-3 border-t border-line pt-4">
        <Link href={`/paneladmin/proyectos/${project.id}`} className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-5 text-sm font-semibold text-white hover:bg-blue-700">
          Abrir proyecto
        </Link>
        <ProjectFavoriteForm projectId={project.id} isFavorite />
      </div>
    </Card>
  )
}
