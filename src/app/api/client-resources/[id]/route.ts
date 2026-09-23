import { getOptionalIdentity, requireClientAccess } from '@/lib/auth'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { canReadResource } from '@/lib/resources/policy.mjs'
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getOptionalIdentity()
  if (!identity) return new Response('Acceso requerido', { status: 401 })
  const clientId = identity.role === 'client' ? (await requireClientAccess()).client.id : undefined
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response('No disponible', { status: 404 })
  const db = getSupabaseAdminClient()
  const { data, error } = await db.from('client_resources').select('*').eq('id', id).maybeSingle()
  if (error || !data || !data.storage_path || !canReadResource({ role: identity.role, clientId }, data.client_id)) return new Response('No disponible', { status: 404 })
  const { data: file, error: storageError } = await db.storage.from('client-resources').download(data.storage_path)
  if (storageError || !file) return new Response('No disponible', { status: 404 })
  const extension = data.storage_path.split('.').pop()
  return new Response(file, { headers: { 'Content-Type': data.content_type || 'application/octet-stream', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `${new URL(request.url).searchParams.has('download') ? 'attachment' : 'inline'}; filename="fotografia-${data.id}.${extension}"` } })
}
