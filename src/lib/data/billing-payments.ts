import 'server-only'

import { requireAdmin } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function getBillingPayments(documentId: string) {
  await requireAdmin()
  const db = await createSupabaseServerClient()
  const { data, error } = await db.from('billing_payments')
    .select('id, document_id, amount_cents, paid_on, method, note, advance_invoice_id, reversed_at, created_at')
    .eq('document_id', documentId).order('paid_on', { ascending: true })
  if (error) throw new Error('No se pudieron cargar los cobros.')
  return data ?? []
}

export async function getBillingPaymentOption(documentId: string) {
  await requireAdmin()
  const db = await createSupabaseServerClient()
  const { data, error } = await db.from('billing_payment_options')
    .select('id, document_id, method, url, instructions, active, updated_at')
    .eq('document_id', documentId).maybeSingle()
  if (error) throw new Error('No se pudo cargar la forma de pago.')
  return data
}
