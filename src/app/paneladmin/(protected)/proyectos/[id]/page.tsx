import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdminShell } from '@/components/layout/app-shell'
import { Card } from '@/components/ui/card'
import { ProjectForm } from '@/components/admin/project-form'
import { ProjectCapabilitiesForm } from '@/components/admin/project-capabilities-form'
import { ProjectClientAccessForm } from '@/components/admin/project-client-access-form'
import { ProjectFavoriteForm } from '@/components/admin/project-favorite-form'
import { SupportPreviewForm } from '@/components/admin/support-preview-form'
import { ProjectToolGrid, projectWorkspaceLabels } from '@/components/admin/project-tool-grid'
import { ProjectIdentity } from '@/components/projects/project-detail'
import { Badge } from '@/components/ui/badge'
import { requireAdmin } from '@/lib/auth'
import { capabilityKeys, getAdminProject, getCapabilityActivationIssue, isAdminProjectFavorite } from '@/lib/data/projects'
import { getLocale } from '@/lib/locale'
import { projectTranslations, supportPreviewTranslations } from '@/lib/i18n'
import type { Json } from '@/lib/supabase/types'

function auditValue(record: Json | null, key: string): string {
  return record && typeof record === 'object' && !Array.isArray(record) && typeof record[key] === 'string' ? record[key] as string : '—'
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const identity = await requireAdmin()
  const locale = await getLocale()
  const copy = projectTranslations[locale]
  const workspaceCopy = projectWorkspaceLabels[locale]
  const supportCopy = supportPreviewTranslations[locale]
  const { id } = await params
  const detail = await getAdminProject(id, locale)
  if (!detail) notFound()
  const { project, clients, client, audit, preview, warnings } = detail
  const validationIssues = Object.fromEntries(capabilityKeys.map(capabilityKey => {
    const capability = project.capabilities.find(item => item.capability_key === capabilityKey) ?? {
      capability_key: capabilityKey, launch_url: null, metadata: {}, validated_at: null,
    }
    return [capabilityKey, getCapabilityActivationIssue(project, capability)]
  }))
  const isFavorite = await isAdminProjectFavorite(identity.userId, project.id)
  const supportDisabledReason = process.env.WF_SUPPORT_PREVIEW_ENABLED !== 'true'
    ? supportCopy.featureDisabled
    : !project.client_id ? supportCopy.projectUnassigned
      : project.status !== 'active' ? supportCopy.projectInactive
        : !project.client_access_enabled ? supportCopy.projectInaccessible
          : client?.status !== 'active' ? supportCopy.assignedClientInactive
            : undefined
  return <AdminShell title={project.name} description={project.domain} currentPath="/paneladmin/proyectos" userEmail={identity.email} locale={locale}>
    <div className="grid gap-6">
      <Link href="/paneladmin/proyectos" className="text-brand underline">← {copy.back}</Link>
      <Card className="flex flex-wrap items-start justify-between gap-5 p-6" data-workspace-section="identity">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ProjectIdentity name={project.name} domain={project.domain} heading="h2" />
            <Badge>{copy.statusLabels[project.status]}</Badge>
          </div>
          <p className="mt-2 text-sm">{copy.client}: {client?.name ?? copy.unassigned} · {project.client_access_enabled ? copy.enabled : copy.disabled}</p>
          <div className="mt-4">
            <SupportPreviewForm
              clientId={client?.id}
              clientName={client?.name ?? copy.unassigned}
              projectId={project.id}
              returnPath={`/paneladmin/proyectos/${project.id}`}
              disabledReason={supportDisabledReason}
              locale={locale}
            />
          </div>
        </div>
        <ProjectFavoriteForm projectId={project.id} isFavorite={isFavorite} />
      </Card>

      <section className="grid gap-4" data-workspace-section="tools">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">{workspaceCopy.operational}</p>
          <h2 className="text-2xl font-bold">{workspaceCopy.tools}</h2>
        </div>
        <ProjectToolGrid project={project} locale={locale} />
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-2" data-workspace-section="client-access">
        <ProjectClientAccessForm key={`${project.updated_at}:${client?.portal_mode}`} project={project} clients={clients} locale={locale} />
        <Card className="grid gap-3 p-6">
          <h2 className="text-xl font-bold">{copy.preview}</h2>
          {client?.status === 'active' ? <>
            <p>{client.name} · {client.portal_mode}</p>
            <ul>{preview.projects.map(project => <li key={project.id}>{project.name} · {project.domain}</li>)}</ul>
            {!preview.projects.length ? <p className="text-sm text-muted">{copy.noProjects}</p> : null}
            <nav aria-label={copy.preview}><ul className="grid gap-2">{preview.navigation.map(item => <li key={item.id}><a href={item.href} className="text-brand underline">{item.label}</a></li>)}</ul></nav>
          </> : <p>{copy.noAccess}</p>}
        </Card>
      </section>

      <Card className="p-6" data-workspace-section="warnings">
        <h2 className="mb-3 text-xl font-bold">{workspaceCopy.warnings}</h2>
        {warnings.length ? <ul className="grid gap-2 text-sm text-amber-900">{warnings.map(warning => <li key={warning}>{copy.warnings[warning]}</li>)}</ul> : <p className="text-sm text-muted">{workspaceCopy.noWarnings}</p>}
      </Card>

      <details className="rounded-panel border border-line bg-slate-50 p-6" data-workspace-section="configuration">
        <summary className="cursor-pointer text-xl font-bold">{copy.edit}</summary>
        <div className="mt-6 grid gap-6">
          <ProjectForm key={project.updated_at} project={project} locale={locale} />
          <ProjectCapabilitiesForm key={project.capabilities.map(capability => capability.updated_at).join()} project={project} capabilities={project.capabilities} validationIssues={validationIssues} locale={locale} />
        </div>
      </details>

      <Card className="p-6" data-workspace-section="audit">
        <h2 className="mb-4 text-xl font-bold">{copy.audit}</h2>
        {audit.length ? <ol className="grid gap-4">{audit.map(entry => <li key={entry.id} className="border-b border-line pb-3 text-sm">
          <time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString(locale, { timeZone: 'Europe/Madrid' })}</time>
          <p>{entry.capability_key} · {entry.operation} · {auditValue(entry.old_record, 'state')} → {auditValue(entry.new_record, 'state')}</p>
          <p className="break-all">{auditValue(entry.old_record, 'launch_url')} → {auditValue(entry.new_record, 'launch_url')}</p>
          <p className="text-muted">{copy.actor}: {entry.actor_id ?? copy.system}</p>
        </li>)}</ol> : <p className="text-sm text-muted">{copy.auditEmpty}</p>}
      </Card>
    </div>
  </AdminShell>
}
