import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { getCapabilityConfigurationIssue, type ProjectWithCapabilities } from '@/lib/data/projects'
import { projectTranslations, type Locale } from '@/lib/i18n'
import { buildProjectTools, type ProjectTool } from '@/lib/projects/tools.mjs'

const stateLabels = {
  es: { active: 'Activo', available: 'Disponible', unavailable: 'No disponible', misconfigured: 'Configuración incompleta' },
  en: { active: 'Active', available: 'Available', unavailable: 'Unavailable', misconfigured: 'Incomplete configuration' },
} as const

const actionLabels = {
  es: { active: 'Abrir', available: 'Pendiente de activación', unavailable: 'No disponible', misconfigured: 'Revisar configuración' },
  en: { active: 'Open', available: 'Pending activation', unavailable: 'Unavailable', misconfigured: 'Review configuration' },
} as const

const compactToolIds = new Set<ProjectTool['id']>(['website', 'blogger', 'analytics'])

export const projectWorkspaceLabels = {
  es: { openProject: 'Abrir proyecto', operational: 'Proyecto operativo', tools: 'Herramientas', warnings: 'Avisos de configuración', noWarnings: 'No hay avisos pendientes.' },
  en: { openProject: 'Open project', operational: 'Operational project', tools: 'Tools', warnings: 'Configuration warnings', noWarnings: 'No pending warnings.' },
} as const

function ToolAction({ tool, locale }: { tool: ProjectTool; locale: Locale }) {
  if (!tool.href || tool.state !== 'active') {
    return <button type="button" disabled className="mt-auto min-h-11 rounded-full bg-slate-100 px-4 text-sm font-semibold text-slate-500">
      {actionLabels[locale][tool.state]}
    </button>
  }

  const className = 'mt-auto inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-4 text-sm font-semibold text-white hover:bg-blue-700'
  return tool.id === 'website'
    ? <a href={tool.href} target="_blank" rel="noopener noreferrer" className={className}>{tool.label}</a>
    : <Link href={tool.href} className={className}>{tool.label}</Link>
}

export function ProjectToolGrid({ project, locale = 'es', compact = false }: { project: ProjectWithCapabilities; locale?: Locale; compact?: boolean }) {
  const configurationIssues = Object.fromEntries(project.capabilities.flatMap(capability => {
    const issue = getCapabilityConfigurationIssue(project, capability)
    return issue ? [[capability.capability_key, projectTranslations[locale].warnings[issue]]] : []
  }))
  const tools = buildProjectTools({ project, viewer: 'admin', configurationIssues })
    .filter(tool => !compact || compactToolIds.has(tool.id))

  return <div className={compact ? 'grid gap-3 sm:grid-cols-3' : 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'}>
    {tools.map(tool => <article
      key={tool.id}
      className="flex min-h-44 flex-col gap-3 rounded-panel border border-line bg-panel p-5 shadow-panel"
      data-project-tool={tool.id}
      data-tool-state={tool.state}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-bold text-foreground">{tool.label}</h3>
        <Badge className={tool.state === 'active' ? 'bg-emerald-50 text-emerald-700' : tool.state === 'misconfigured' ? 'bg-amber-50 text-amber-800' : ''}>
          {stateLabels[locale][tool.state]}
        </Badge>
      </div>
      {tool.warning ? <p className="text-xs text-amber-800">{tool.warning}</p> : null}
      <ToolAction tool={tool} locale={locale} />
    </article>)}
  </div>
}
