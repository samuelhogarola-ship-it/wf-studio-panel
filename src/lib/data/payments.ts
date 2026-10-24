import 'server-only'

import { requireAdmin } from '@/lib/auth'
import { requirePortalViewer } from '@/lib/support/portal-viewer'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function getClientPaymentRequests() {
  const viewer = await requirePortalViewer()
  const db = await createSupabaseServerClient()
  const { data, error } = await db.from('payment_requests').select('id, recipient_name, concept, amount, status, created_at').eq('client_id', viewer.client.id).order('created_at', { ascending: false })
  if (error) throw new Error('No se pudieron cargar las solicitudes de pago.')
  return data ?? []
}

export async function getClientPaymentLinks() {
  await requirePortalViewer()
  const db = await createSupabaseServerClient()
  const { data, error } = await db.from('payment_links').select('id, invoice_id, payment_request_id, provider, url, created_at').order('created_at', { ascending: false })
  if (error) throw new Error('No se pudieron cargar los enlaces de pago.')
  return data ?? []
}

export async function getAdminPaymentRequests() {
  await requireAdmin()
  const db = await createSupabaseServerClient()
  const { data, error } = await db.from('payment_requests').select('id, client_id, recipient_name, recipient_email, concept, amount, status, created_at').order('created_at', { ascending: false })
  if (error) throw new Error('No se pudieron cargar las solicitudes de pago.')
  return data ?? []
}
