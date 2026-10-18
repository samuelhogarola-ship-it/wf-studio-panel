'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { assignProjectClientAction, setProjectAccessAction, setClientPortalModeAction, type ProjectFormState } from '@/lib/actions/projects'
import type { Project, ProjectClient } from '@/lib/data/projects'
import { projectTranslations, type Locale } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { FormMessage } from '@/components/ui/form-message'

export function ProjectClientAccessForm({ project, clients, locale }: { project: Project; clients: ProjectClient[]; locale: Locale }) {
  const [assignment, assign, assigning] = useActionState(assignProjectClientAction, {} as ProjectFormState)
  const [access, changeAccess, changingAccess] = useActionState(setProjectAccessAction, {} as ProjectFormState)
  const [mode, changeMode, changingMode] = useActionState(setClientPortalModeAction, {} as ProjectFormState)
  const copy = projectTranslations[locale]
  const client = clients.find(client => client.id === project.client_id)
  return <Card className="grid gap-5 p-6">
    <h2 className="text-xl font-bold">{copy.access}</h2>
    <form action={assign} className="grid gap-3">
      <input type="hidden" name="project_id" value={project.id} />
      <div><Label htmlFor="assign-client">{copy.client}</Label><Select id="assign-client" name="client_id" defaultValue={project.client_id ?? ''}>
        <option value="">{copy.unassigned}</option>{clients.filter(client => client.status === 'active' || client.id === project.client_id).map(client => <option key={client.id} value={client.id} disabled={client.status !== 'active'}>{client.name} · {client.email}</option>)}
      </Select></div>
      <p className="text-xs text-muted">{copy.reassignment}</p><FormMessage {...assignment} />
      <Button type="submit" disabled={assigning}>{copy.assign}</Button>
    </form>
    <form action={changeAccess} className="grid gap-3">
      <input type="hidden" name="project_id" value={project.id} />
      <div><Label htmlFor="project-access">{copy.access}</Label><Select id="project-access" name="enabled" defaultValue={String(project.client_access_enabled)}>
        <option value="false">{copy.disabled}</option><option value="true">{copy.enabled}</option>
      </Select></div><FormMessage {...access} /><Button type="submit" disabled={changingAccess}>{copy.applyAccess}</Button>
    </form>
    {client ? <form action={changeMode} className="grid gap-3">
      <input type="hidden" name="client_id" value={client.id} />
      <div><Label htmlFor="portal-mode">{copy.mode}</Label><Select id="portal-mode" name="portal_mode" defaultValue={client.portal_mode}>
        <option value="legacy">{copy.legacy}</option><option value="dynamic">{copy.dynamic}</option>
      </Select></div><p className="text-xs text-muted">{copy.modeNote}</p><FormMessage {...mode} /><Button type="submit" disabled={changingMode}>{copy.applyMode}</Button>
    </form> : null}
    <Link href="/paneladmin/clientes" className="text-sm text-brand underline">{copy.invite}</Link>
  </Card>
}
