'use server'

import 'server-only'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { validateProjectDestination } from '@/lib/projects/model.mjs'
import { getCapabilityActivationIssue, getCapabilityConfigurationIssue, hasProjectAnalytics } from '@/lib/data/projects'
import type { Project, ProjectClient } from '@/lib/data/projects'
import type { TablesUpdate } from '@/lib/supabase/types'

export type ProjectFormState = { error?: string; success?: string }
type DB = Awaited<ReturnType<typeof createSupabaseServerClient>>
const uuid = z.string().uuid()
const projectSchema = z.object({
  id: z.union([uuid, z.literal('')]), slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(100),
  name: z.string().trim().min(1).max(200), domain: z.string().trim().toLowerCase().transform(value => value.replace(/^www\./, '')),
  status: z.enum(['draft', 'active', 'archived']), product_tier: z.union([z.enum(['lite', 'express', 'pro']), z.literal('')]).transform(value => value || null),
  hosting_label: z.string().trim().max(200),
  hosting_management_url: z.string().trim().max(2048), analytics_registry_key: z.string().trim().max(100),
})
const capabilitySchema = z.object({
  project_id: uuid, capability_key: z.enum(['products', 'domains', 'hosting', 'invoices', 'bonuses_reports', 'blogger', 'analytics']),
  state: z.enum(['unavailable', 'available', 'active']), launch_url: z.string().max(2048),
})
const read = (form: FormData, key: string) => form.get(key) ?? ''
const failure = (error = 'No se pudo guardar. Revisa los datos y vuelve a intentarlo.'): ProjectFormState => ({ error })

async function findProject(db: DB, id: string): Promise<Project | null> {
  const { data, error } = await db.from('client_projects').select('*').eq('id', id).maybeSingle()
  return error ? null : data
}
async function findClient(db: DB, id: string): Promise<ProjectClient | null> {
  const { data, error } = await db.from('clients').select('id, name, email, status, project, portal_mode').eq('id', id).eq('project', 'wf-studio').eq('status', 'active').maybeSingle()
  return error ? null : data
}
function updateProjectSnapshot(db: DB, project: Project, payload: TablesUpdate<'client_projects'>) {
  // Check the validated assignment and version in the UPDATE itself. The existing
  // database trigger changes updated_at on every write, including owner A→B→A.
  const query = db.from('client_projects').update(payload).eq('id', project.id).eq('updated_at', project.updated_at)
  return project.client_id === null ? query.is('client_id', null) : query.eq('client_id', project.client_id)
}
function saved(id?: string): ProjectFormState {
  revalidatePath('/paneladmin/proyectos')
  if (id) revalidatePath(`/paneladmin/proyectos/${id}`)
  // Includes the shell and account pages affected by assignment and capabilities.
  revalidatePath('/cliente', 'layout')
  return { success: 'Cambios guardados.' }
}

export async function upsertProjectAction(_previous: ProjectFormState, form: FormData): Promise<ProjectFormState> {
  await requireAdmin()
  const parsed = projectSchema.safeParse(Object.fromEntries(['id', 'slug', 'name', 'domain', 'status', 'product_tier', 'hosting_label', 'hosting_management_url', 'analytics_registry_key'].map(key => [key, read(form, key)])))
  if (!parsed.success) return failure()
  const { id, ...values } = parsed.data
  if (!validateProjectDestination(`https://${values.domain}`, values.domain, true) ||
    (values.hosting_management_url && !validateProjectDestination(values.hosting_management_url, values.domain, true))) return failure('Dominio o destino de hosting no válido.')
  const db = await createSupabaseServerClient()
  let current: Project | null = null
  if (id) {
    current = await findProject(db, id)
    if (!current || current.slug !== values.slug) return failure('El identificador del proyecto es estable y no se puede cambiar.')
    const snapshot = current
    const { data: capabilities, error } = await db.from('project_capabilities').select('*').eq('project_id', id).eq('state', 'active')
    if (error) return failure()
    if (capabilities?.some(capability => getCapabilityConfigurationIssue({ ...snapshot, ...values }, capability))) return failure('Desactiva o reconfigura las capacidades antes de cambiar sus destinos.')
  }
  const payload = { ...values, hosting_label: values.hosting_label || null, hosting_management_url: values.hosting_management_url || null, analytics_registry_key: values.analytics_registry_key || null }
  if (id && current) {
    const result = await updateProjectSnapshot(db, current, payload).select('id').maybeSingle()
    if (result.error) return failure()
    return result.data ? saved(result.data.id) : failure('El proyecto ha cambiado. Recarga la página antes de modificarlo.')
  }
  const result = await db.from('client_projects').insert(payload).select('id').single()
  return result.error || !result.data ? failure() : saved(result.data.id)
}

export async function assignProjectClientAction(_previous: ProjectFormState, form: FormData): Promise<ProjectFormState> {
  await requireAdmin()
  const parsed = z.object({ project_id: uuid, client_id: z.union([uuid, z.literal('')]) }).safeParse({ project_id: read(form, 'project_id'), client_id: read(form, 'client_id') })
  if (!parsed.success) return failure()
  const db = await createSupabaseServerClient()
  const project = await findProject(db, parsed.data.project_id)
  const clientId = parsed.data.client_id || null
  if (!project || (clientId && !await findClient(db, clientId))) return failure('Selecciona un cliente activo de WF Studio.')
  const result = await updateProjectSnapshot(db, project, { client_id: clientId, ...(project.client_id !== clientId ? { client_access_enabled: false } : {}) }).select('id').maybeSingle()
  if (result.error) return failure()
  return result.data ? saved(project.id) : failure('El proyecto ha cambiado. Recarga la página antes de modificar su asignación.')
}

export async function setProjectAccessAction(_previous: ProjectFormState, form: FormData): Promise<ProjectFormState> {
  await requireAdmin()
  const parsed = z.object({ project_id: uuid, enabled: z.enum(['true', 'false']) }).safeParse({ project_id: read(form, 'project_id'), enabled: read(form, 'enabled') })
  if (!parsed.success) return failure()
  const db = await createSupabaseServerClient()
  const project = await findProject(db, parsed.data.project_id)
  if (!project) return failure()
  const enabled = parsed.data.enabled === 'true'
  if (enabled && (project.status !== 'active' || !project.client_id || !await findClient(db, project.client_id))) return failure('El acceso requiere un proyecto activo asignado a un cliente activo de WF Studio.')
  const result = await updateProjectSnapshot(db, project, { client_access_enabled: enabled }).select('id').maybeSingle()
  if (result.error) return failure()
  return result.data ? saved(project.id) : failure('El proyecto ha cambiado. Recarga la página antes de modificar su acceso.')
}

export async function setClientPortalModeAction(_previous: ProjectFormState, form: FormData): Promise<ProjectFormState> {
  await requireAdmin()
  const parsed = z.object({ client_id: uuid, portal_mode: z.enum(['legacy', 'dynamic']) }).safeParse({ client_id: read(form, 'client_id'), portal_mode: read(form, 'portal_mode') })
  if (!parsed.success) return failure()
  const db = await createSupabaseServerClient()
  const client = await findClient(db, parsed.data.client_id)
  if (!client) return failure('Selecciona un cliente activo de WF Studio.')
  if (parsed.data.portal_mode === 'dynamic') {
    const { data, error } = await db.from('client_projects').select('id').eq('client_id', client.id).eq('status', 'active').eq('client_access_enabled', true).limit(1)
    if (error || !data?.length) return failure('El modo dinámico requiere al menos un proyecto activo y accesible.')
  }
  const result = await db.from('clients').update({ portal_mode: parsed.data.portal_mode }).eq('id', client.id).eq('project', 'wf-studio').select('id').maybeSingle()
  return result.error || !result.data ? failure() : saved()
}

export async function upsertProjectCapabilityAction(_previous: ProjectFormState, form: FormData): Promise<ProjectFormState> {
  await requireAdmin()
  const parsed = capabilitySchema.safeParse(Object.fromEntries(['project_id', 'capability_key', 'state', 'launch_url'].map(key => [key, read(form, key)])))
  if (!parsed.success) return failure()
  const db = await createSupabaseServerClient()
  const project = await findProject(db, parsed.data.project_id)
  if (!project) return failure()
  const { data: existing, error: readError } = await db.from('project_capabilities').select('metadata')
    .eq('project_id', project.id).eq('capability_key', parsed.data.capability_key).maybeSingle()
  if (readError) return failure()
  const metadata = existing?.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata) ? existing.metadata : {}
  const provisioningConfirmed = read(form, 'provisioning_confirmed') === 'true'
  const payload = {
    ...parsed.data, launch_url: parsed.data.launch_url || null,
    metadata: parsed.data.capability_key === 'blogger' ? { ...metadata, provisioning_confirmed: provisioningConfirmed } : metadata,
    validated_at: parsed.data.state === 'active' ? new Date().toISOString() : null,
  }
  if (payload.state === 'active' && payload.capability_key === 'analytics' && !hasProjectAnalytics(project)) {
    return failure('No se puede activar Analítica: revisa la clave del registro, el dominio, el website ID y la conexión Umami.')
  }
  if (payload.state === 'active' && payload.capability_key === 'blogger' && getCapabilityActivationIssue(project, payload)) {
    return failure('No se puede activar Blogger: revisa el proyecto registrado, el runtime, el destino y la confirmación del aprovisionamiento.')
  }
  if (payload.state === 'active' && getCapabilityConfigurationIssue(project, payload)) {
    return failure('La activación requiere un destino válido y la configuración completa de la herramienta.')
  }
  // The database trigger records old/new values and auth.uid() from this session.
  const { error } = await db.from('project_capabilities').upsert(payload, { onConflict: 'project_id,capability_key' })
  return error ? failure() : saved(project.id)
}
