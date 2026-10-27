import 'server-only'

import { hashBillingShareToken } from '@/lib/billing/share-token'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type SharedBillingBundle = {
  document: { id: string; number: string | null; document_type: string; title: string; recipient_name: string; document_date: string; due_date: string | null; net_cents: number; tax_cents: number; total_cents: number }
  lines: Array<{ id: string; description: string; quantity: number; unit_net_cents: number; tax_cents: number; total_cents: number }>
  payments: Array<{ id: string; amount_cents: number; paid_on: string; method: string }>
  paymentOption: { method: string; url: string | null; instructions: string | null; active: boolean } | null
}

export async function getSharedBillingDocument(rawToken: string): Promise<SharedBillingBundle | null> {
  if (!/^[a-f0-9]{64}$/.test(rawToken)) return null
  const db = await createSupabaseServerClient()
  const { data, error } = await db.rpc('resolve_billing_share', { p_token_hash: hashBillingShareToken(rawToken) })
  if (error || !data) return null
  return data as unknown as SharedBillingBundle
}

export async function getClientBillingDocuments(clientId: string) {
  const db = await createSupabaseServerClient()
  const { data: documents } = await db.from('billing_documents').select('*').eq('client_id', clientId).in('status', ['issued', 'paid']).order('document_date', { ascending: false })
  const result = []
  for (const document of documents ?? []) {
    const [{ data: payments }, { data: paymentOption }] = await Promise.all([
      db.from('billing_payments').select('*').eq('document_id', document.id).is('reversed_at', null),
      db.from('billing_payment_options').select('*').eq('document_id', document.id).eq('active', true).maybeSingle(),
    ])
    const paidCents = (payments ?? []).reduce((sum, payment) => sum + payment.amount_cents, 0)
    result.push({ ...document, paidCents, balanceCents: Math.max(0, document.total_cents - paidCents), paymentOption })
  }
  return result
}
