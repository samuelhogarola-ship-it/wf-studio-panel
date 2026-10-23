import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
// Callers must resolve and authorize the client before calling this server-only repository.
export async function listResources(clientId: string) {
  const db = await createSupabaseServerClient()
  const { data, error } = await db.from('client_resources').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
  if (error) throw new Error('No se pudieron cargar los recursos del cliente.')
  return data ?? []
}
