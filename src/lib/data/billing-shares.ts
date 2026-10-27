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
  const { data: documents, error: documentsError } = await db.from('billing_documents').select('*').eq('client_id', clientId).in('status', ['issued', 'paid']).order('document_date', { ascending: false })
  if (documentsError) throw new Error('No se pudieron cargar los documentos de facturación.')
  if (!documents?.length) return []

  const ids = documents.map(document => document.id)
  const idList = ids.join(',')
  const [{ data: payments, error: paymentsError }, { data: paymentOptions, error: optionsError }] = await Promise.all([
    db.from('billing_payments').select('*')
      .or(`document_id.in.(${idList}),advance_invoice_id.in.(${idList})`).is('reversed_at', null),
    db.from('billing_payment_options').select('*').in('document_id', ids).eq('active', true),
  ])
  if (paymentsError || optionsError) throw new Error('No se pudieron cargar los cobros de facturación.')

  const paymentsByDocument = new Map<string, Map<string, number>>()
  for (const payment of payments ?? []) {
    for (const documentId of [payment.document_id, payment.advance_invoice_id]) {
      if (!documentId || !ids.includes(documentId)) continue
      const documentPayments = paymentsByDocument.get(documentId) ?? new Map<string, number>()
      documentPayments.set(payment.id, payment.amount_cents)
      paymentsByDocument.set(documentId, documentPayments)
    }
  }
  const optionsByDocument = new Map((paymentOptions ?? []).map(option => [option.document_id, option]))
  return documents.map(document => {
    const paidCents = [...(paymentsByDocument.get(document.id)?.values() ?? [])].reduce((sum, amount) => sum + amount, 0)
    return { ...document, paidCents, balanceCents: Math.max(0, document.total_cents - paidCents), paymentOption: optionsByDocument.get(document.id) ?? null }
  })
}
