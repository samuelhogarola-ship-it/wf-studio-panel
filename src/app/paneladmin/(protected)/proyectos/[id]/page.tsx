import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdminShell } from '@/components/layout/app-shell'
import { Card } from '@/components/ui/card'
import { ProjectForm } from '@/components/admin/project-form'
import { ProjectCapabilitiesForm } from '@/components/admin/project-capabilities-form'
import { ProjectClientAccessForm } from '@/components/admin/project-client-access-form'
import { requireAdmin } from '@/lib/auth'
import { getAdminProject } from '@/lib/data/projects'
import { getLocale } from '@/lib/locale'
import { projectTranslations } from '@/lib/i18n'
import type { Json } from '@/lib/supabase/types'

function auditValue(record: Json | null, key: string): string {
  return record && typeof record === 'object' && !Array.isArray(record) && typeof record[key] === 'string' ? record[key] as string : '—'
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const identity = await requireAdmin()
  const locale = await getLocale()
  const copy = projectTranslations[locale]
  const { id } = await params
  const detail = await getAdminProject(id, locale)
  if (!detail) notFound()
  const { project, clients, client, audit, preview, warnings } = detail
  return <AdminShell title={project.name} description={project.domain} currentPath="/paneladmin/proyectos" userEmail={identity.email} locale={locale}>
    <div className="grid gap-6">
      <Link href="/paneladmin/proyectos" className="text-brand underline">← {copy.back}</Link>
      {warnings.length ? <ul className="grid gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{warnings.map(warning => <li key={warning}>{copy.warnings[warning]}</li>)}</ul> : null}
      <ProjectForm key={project.updated_at} project={project} locale={locale} />
      <ProjectCapabilitiesForm key={project.capabilities.map(capability => capability.updated_at).join()} project={project} capabilities={project.capabilities} locale={locale} />
      <div className="grid items-start gap-4 xl:grid-cols-2">
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
      </div>
      <Card className="p-6">
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
