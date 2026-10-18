'use client'

import { useActionState } from 'react'
import { upsertProjectAction, type ProjectFormState } from '@/lib/actions/projects'
import type { Project } from '@/lib/data/projects'
import { projectTranslations, type Locale } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { FormMessage } from '@/components/ui/form-message'

export function ProjectForm({ project, locale }: { project?: Project; locale: Locale }) {
  const [state, action, pending] = useActionState(upsertProjectAction, {} as ProjectFormState)
  const copy = projectTranslations[locale]
  return <Card className="p-6">
    <h2 className="mb-4 text-xl font-bold">{project ? copy.edit : copy.register}</h2>
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="id" value={project?.id ?? ''} />
      {([
        ['name', copy.name], ['slug', copy.slug], ['domain', copy.domain],
        ['hosting_label', copy.hosting], ['hosting_management_url', copy.hostingUrl], ['analytics_registry_key', copy.analyticsKey],
      ] as const).map(([key, label]) => <div key={key}>
        <Label htmlFor={`project-${key}`}>{label}</Label>
        <Input id={`project-${key}`} name={key} defaultValue={project?.[key] ?? ''} required={['name', 'slug', 'domain'].includes(key)} readOnly={key === 'slug' && Boolean(project)} />
      </div>)}
      <div><Label htmlFor="project-status">{copy.status}</Label>
        <Select id="project-status" name="status" defaultValue={project?.status ?? 'draft'}>
          {(['draft', 'active', 'archived'] as const).map(status => <option key={status} value={status}>{copy.statusLabels[status]}</option>)}
        </Select>
      </div>
      <div className="md:col-span-2"><FormMessage {...state} /><Button type="submit" disabled={pending}>{pending ? copy.saving : copy.save}</Button></div>
    </form>
  </Card>
}
