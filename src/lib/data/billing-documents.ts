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
  const [{ data: document, error }, { data: lines }, { data: payments }, { data: paymentOption }] = await Promise.all([
    db.from('billing_documents').select('*').eq('id', id).maybeSingle(),
    db.from('billing_document_lines').select('*').eq('document_id', id).order('sort_order'),
    db.from('billing_payments').select('*').eq('document_id', id).order('paid_on'),
    db.from('billing_payment_options').select('*').eq('document_id', id).maybeSingle(),
  ])
  if (error) throw new Error('No se pudo cargar el documento.')
  return document ? { document, lines: lines ?? [], payments: payments ?? [], paymentOption } : null
}
