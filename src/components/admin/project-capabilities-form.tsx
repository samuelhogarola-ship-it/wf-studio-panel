'use client'

import { useActionState } from 'react'
import { upsertProjectCapabilityAction, type ProjectFormState } from '@/lib/actions/projects'
import type { Project, ProjectCapability } from '@/lib/data/projects'
import type { CapabilityKey } from '@/lib/supabase/types'
import { validateBloggerProjectDestination, validateProjectDestination } from '@/lib/projects/model.mjs'
import { projectTranslations, type Locale } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { FormMessage } from '@/components/ui/form-message'

function CapabilityCard({ project, capabilityKey, capability, locale }: { project: Project; capabilityKey: CapabilityKey; capability?: ProjectCapability; locale: Locale }) {
  const [state, action, pending] = useActionState(upsertProjectCapabilityAction, {} as ProjectFormState)
  const copy = projectTranslations[locale]
  const prefix = `capability-${capabilityKey}`
  const metadata = capability?.metadata
  const confirmed = metadata && typeof metadata === 'object' && !Array.isArray(metadata) && metadata.provisioning_confirmed === true
  return <Card className="p-5" data-capability={capabilityKey}>
    <h3 className="text-lg font-bold">{copy.capabilities[capabilityKey]}</h3>
    <p className="my-2 text-xs text-muted">{copy.lastValidation}: {capability?.validated_at ? new Date(capability.validated_at).toLocaleString(locale, { timeZone: 'Europe/Madrid' }) : copy.never}</p>
    <form action={action} className="grid gap-3">
      <input type="hidden" name="project_id" value={project.id} /><input type="hidden" name="capability_key" value={capabilityKey} />
      <div><Label htmlFor={`${prefix}-state`}>{copy.status}</Label><Select id={`${prefix}-state`} name="state" defaultValue={capability?.state ?? 'unavailable'}>
        {(['unavailable', 'available', 'active'] as const).map(value => <option key={value} value={value}>{copy.states[value]}</option>)}
      </Select></div>
      <div><Label htmlFor={`${prefix}-url`}>{copy.destination}</Label><Input id={`${prefix}-url`} name="launch_url" defaultValue={capability?.launch_url ?? ''} /></div>
      {capabilityKey === 'blogger' ? <>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="provisioning_confirmed" value="true" defaultChecked={Boolean(confirmed)} />{copy.provisioning}</label>
        <p className="text-xs text-muted">{copy.bloggerNote}</p>
      </> : null}
      {capability?.launch_url && (capabilityKey === 'blogger'
        ? validateBloggerProjectDestination(capability.launch_url, project.domain, project.slug)
        : validateProjectDestination(capability.launch_url, project.domain, true)) ? <a href={capability.launch_url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand underline">{copy.open} ↗</a> : null}
      <FormMessage {...state} /><Button type="submit" disabled={pending}>{pending ? copy.saving : copy.save}</Button>
    </form>
  </Card>
}

export function ProjectCapabilitiesForm({ project, capabilities = [], locale }: { project: Project; capabilities?: ProjectCapability[]; locale: Locale }) {
  return <div className="grid gap-4 md:grid-cols-2">{(Object.keys(projectTranslations[locale].capabilities) as CapabilityKey[]).map(key =>
    <CapabilityCard key={key} project={project} capabilityKey={key} capability={capabilities.find(capability => capability.capability_key === key)} locale={locale} />)}</div>
}
