import { getOptionalIdentity } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOptionalSupportViewer, requirePortalViewer } from '@/lib/support/portal-viewer'

function isOwnedStoragePath(storagePath: string, ownerClientId: string) {
  if (storagePath.includes('%') || storagePath.includes('\\') || /[\u0000-\u001f\u007f]/.test(storagePath)) return false
  const segments = storagePath.split('/')
  return segments.length >= 2
    && segments[0] === ownerClientId
    && segments.every(segment => segment !== '' && segment !== '.' && segment !== '..')
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getOptionalIdentity()
  if (!identity) return new Response('Acceso requerido', { status: 401 })
  const viewer = identity.role === 'client'
    ? await requirePortalViewer()
    : identity.role === 'admin'
      ? await getOptionalSupportViewer()
      : null
  if (identity.role !== 'client' && identity.role !== 'admin') return new Response('No disponible', { status: 404 })
  const clientId = viewer?.client.id
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response('No disponible', { status: 404 })
  const db = await createSupabaseServerClient()
  let query = db.from('client_resources').select('*').eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { data, error } = await query.maybeSingle()
  if (error || !data || !data.storage_path) return new Response('No disponible', { status: 404 })
  const storageOwnerId = clientId ?? data.client_id
  if (typeof storageOwnerId !== 'string' || !isOwnedStoragePath(data.storage_path, storageOwnerId)) {
    return new Response('No disponible', { status: 404 })
  }
  const { data: file, error: storageError } = await db.storage.from('client-resources').download(data.storage_path)
  if (storageError || !file) return new Response('No disponible', { status: 404 })
  const extension = data.storage_path.split('.').pop()
  return new Response(file, { headers: { 'Content-Type': data.content_type || 'application/octet-stream', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `${new URL(request.url).searchParams.has('download') ? 'attachment' : 'inline'}; filename="fotografia-${data.id}.${extension}"` } })
}
