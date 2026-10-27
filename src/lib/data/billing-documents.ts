import 'server-only'

import { requireAdmin } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function getBillingWorkspaceData() {
  await requireAdmin()
  const db = await createSupabaseServerClient()
  const [{ data: products }, { data: documents }, { data: clients }] = await Promise.all([
    db.from('billing_products').select('*').order('sort_order').order('name'),
    db.from('billing_documents').select('*').order('document_date', { ascending: false }).limit(100),
    db.from('clients').select('id, name, email, company, status').eq('project', 'wf-studio').order('name'),
  ])
  return { products: products ?? [], documents: documents ?? [], clients: clients ?? [] }
}

export async function getBillingDocument(id: string) {
  await requireAdmin()
  const db = await createSupabaseServerClient()
  const [documentResult, linesResult, paymentsResult, optionResult, shareResult] = await Promise.all([
    db.from('billing_documents').select('*').eq('id', id).maybeSingle(),
    db.from('billing_document_lines').select('*').eq('document_id', id).order('sort_order'),
    db.from('billing_payments').select('*').or(`document_id.eq.${id},advance_invoice_id.eq.${id}`).order('paid_on'),
    db.from('billing_payment_options').select('*').eq('document_id', id).maybeSingle(),
    db.from('billing_share_links').select('id, expires_at').eq('document_id', id)
      .is('revoked_at', null).gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const loadError = [documentResult.error, linesResult.error, paymentsResult.error, optionResult.error, shareResult.error].find(Boolean)
  if (loadError) throw new Error('No se pudo cargar el documento.')
  return documentResult.data ? {
    document: documentResult.data,
    lines: linesResult.data ?? [],
    payments: paymentsResult.data ?? [],
    paymentOption: optionResult.data,
    activeShare: shareResult.data,
  } : null
}
