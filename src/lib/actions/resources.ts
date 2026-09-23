 'use server'
import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin, requireClientAccess } from '@/lib/auth'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { validateImage } from '@/lib/resources/policy.mjs'
export type ResourceState = { error?: string; success?: string }
const schema = z.object({ clientId: z.string().uuid(), title: z.string().trim().min(1).max(200), body: z.string().max(10000), kind: z.enum(['report','update','photo']), reportPath: z.string() })
async function save(form: FormData, clientId: string, userId: string, photosOnly: boolean): Promise<ResourceState> {
  const parsed = schema.safeParse({ clientId, title: form.get('title'), body: form.get('body') || '', kind: photosOnly ? 'photo' : form.get('kind'), reportPath: form.get('reportPath') || '' })
  if (!parsed.success) return { error: 'Revisa el título y los campos.' }
  const d = parsed.data
  if (d.kind === 'report' && !/^\/informes\/[a-z0-9-]+$/.test(d.reportPath)) return { error: 'Indica una ruta de informe válida del panel.' }
  const db = getSupabaseAdminClient()
  const { data: client, error: clientError } = await db.from('clients').select('id').eq('id', d.clientId).eq('project', 'wf-studio').maybeSingle()
  if (clientError || !client) return { error: 'Cliente no disponible.' }
  let storagePath: string | null = null
  let contentType: string | null = null
  if (d.kind === 'photo') {
    const file = form.get('file')
    if (!(file instanceof File) || file.size > 10 * 1024 * 1024) return { error: 'Selecciona una imagen de hasta 10 MB.' }
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (!validateImage(bytes, file.type)) return { error: 'La imagen debe ser JPG, PNG o WebP válida.' }
    contentType = file.type
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type]
    storagePath = `${d.clientId}/${randomUUID()}.${extension}`
    const { error } = await db.storage.from('client-resources').upload(storagePath, bytes, { contentType, upsert: false })
    if (error) return { error: 'No se pudo guardar la fotografía. Inténtalo de nuevo.' }
  }
  const { error } = await db.from('client_resources').insert({ client_id: d.clientId, kind: d.kind, title: d.title, body: d.body, report_path: d.kind === 'report' ? d.reportPath : null, storage_path: storagePath, content_type: contentType, created_by: userId })
  if (error) {
    if (storagePath) await db.storage.from('client-resources').remove([storagePath])
    return { error: 'No se pudo guardar el recurso.' }
  }
  for (const page of ['informes','actualizaciones','fotografias']) revalidatePath(`/cliente/${page}`)
  revalidatePath(`/paneladmin/clientes/${d.clientId}/recursos`)
  return { success: 'Guardado en el panel del cliente.' }
}
export async function publishResource(_prev: ResourceState, form: FormData): Promise<ResourceState> {
  const identity = await requireAdmin()
  return save(form, String(form.get('clientId') || ''), identity.userId, false)
}
export async function uploadClientPhoto(_prev: ResourceState, form: FormData): Promise<ResourceState> {
  const identity = await requireClientAccess()
  return save(form, identity.client.id, identity.userId, true)
}
