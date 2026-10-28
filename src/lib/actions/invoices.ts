'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth'
import { invoiceDraftSchema, parseStripePaymentLink } from '@/lib/payments/schema'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type InvoiceFormState = {
  error?: string
  success?: string
}

export async function createInvoiceAction(prevState: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()

  const clientId = String(formData.get('client_id') ?? '').trim() || null
  let recipient = { clientId, name: String(formData.get('recipient_name') ?? '').trim(), email: String(formData.get('recipient_email') ?? '').trim(), company: String(formData.get('recipient_company') ?? '').trim() || null }
  if (clientId) {
    const { data: client, error } = await supabase.from('clients').select('id, name, email, company, project, status').eq('id', clientId).maybeSingle()
    if (error || !client || client.project !== 'wf-studio' || client.status !== 'active') return { error: 'Cliente no disponible.' }
    recipient = { clientId: client.id, name: client.name, email: client.email, company: client.company }
  }
  const parsed = invoiceDraftSchema.safeParse({
    recipient,
    concept: formData.get('concept'),
    amount: Number(formData.get('amount')),
    paymentMethod: formData.get('payment_method'),
    documentType: formData.get('document_type'),
    accountingArea: formData.get('accounting_area'),
    transferInstructions: String(formData.get('transfer_instructions') ?? '').trim() || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
    issuedAt: String(formData.get('issued_at') ?? '').trim() || undefined,
  })
  if (!parsed.success) return { error: 'Revisa destinatario, concepto e importe.' }

  const { data, error } = await supabase.rpc('create_billing_document_draft', {
    p_client_id: parsed.data.recipient.clientId,
    p_recipient_kind: parsed.data.recipient.clientId ? 'registered' : 'external',
    p_recipient_name: parsed.data.recipient.name,
    p_recipient_email: parsed.data.recipient.email,
    p_recipient_company: parsed.data.recipient.company ?? null,
    p_concept: parsed.data.concept,
    p_amount: parsed.data.amount,
    p_payment_method: parsed.data.paymentMethod,
    p_document_type: parsed.data.documentType,
    p_accounting_area: parsed.data.accountingArea,
    p_transfer_instructions: parsed.data.transferInstructions ?? null,
    p_notes: parsed.data.notes ?? null,
    p_issued_at: parsed.data.issuedAt ?? new Date().toISOString().slice(0, 10),
  })
  const draft = Array.isArray(data) ? data[0] : data
  if (error || !draft?.id || !draft.number) return { error: 'No se pudo crear el documento.' }
  const paymentUrl = formData.get('payment_url')
  const link = paymentUrl ? parseStripePaymentLink(paymentUrl) : { success: true as const, data: null }
  if (!link.success) return { error: 'El enlace de pago debe ser un enlace Stripe HTTPS válido.' }
  const { error: issueError } = await supabase.rpc('issue_billing_document', { p_document_id: draft.id, p_payment_url: link.data })
  if (issueError) return { error: 'No se pudo emitir el documento.' }

  revalidatePath('/paneladmin/facturas')
  revalidatePath('/cliente/facturas')
  return { success: `${parsed.data.documentType === 'proposal' ? 'Propuesta' : 'Factura'} ${draft.number} creada correctamente.` }
}

export async function markInvoicePaidAction(formData: FormData) {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()

  const id = String(formData.get('id') ?? '')
  if (!id) return

  const { data, error } = await supabase.rpc('mark_invoice_paid', { p_invoice_id: id })
  if (error || !data) return

  revalidatePath('/paneladmin/facturas')
  revalidatePath('/cliente/facturas')
}

export async function deleteInvoiceAction() {
  await requireAdmin()
}
