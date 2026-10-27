'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireAdmin } from '@/lib/auth'
import { billingPaymentInputSchema } from '@/lib/billing/schema'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type BillingPaymentActionState = { error?: string; success?: string; advanceInvoiceId?: string | null }

const documentIdSchema = z.string().uuid()
const paymentOptionSchema = z.object({
  documentId: documentIdSchema,
  method: z.enum(['manual_link', 'transfer', 'cash']),
  url: z.string().url().refine(value => new URL(value).protocol === 'https:', 'El enlace debe usar HTTPS.').nullable(),
  instructions: z.string().trim().max(2_000).nullable(),
  active: z.boolean(),
}).superRefine((value, context) => {
  if (value.method === 'manual_link' && !value.url) context.addIssue({ code: 'custom', path: ['url'], message: 'Falta el enlace de pago.' })
})

function revalidateBilling() {
  revalidatePath('/paneladmin/contabilidad')
  revalidatePath('/cliente/facturas')
  revalidatePath('/cliente/pagos')
}

export async function recordBillingPaymentAction(_previous: BillingPaymentActionState, formData: FormData): Promise<BillingPaymentActionState> {
  await requireAdmin()
  const documentId = documentIdSchema.safeParse(String(formData.get('document_id') ?? ''))
  const payment = billingPaymentInputSchema.safeParse({
    amountCents: Number(formData.get('amount_cents')),
    paidOn: String(formData.get('paid_on') ?? ''),
    method: formData.get('method'),
    note: String(formData.get('note') ?? '').trim() || null,
  })
  if (!documentId.success || !payment.success) return { error: 'Revisa el documento, importe, fecha y forma de pago.' }
  const db = await createSupabaseServerClient()
  const { data, error } = await db.rpc('record_billing_payment', {
    p_document_id: documentId.data,
    p_amount_cents: payment.data.amountCents,
    p_paid_on: payment.data.paidOn,
    p_method: payment.data.method,
    p_note: payment.data.note ?? null,
  })
  const saved = Array.isArray(data) ? data[0] : data
  if (error || !saved?.payment_id) return { error: 'No se pudo registrar el cobro. Comprueba el saldo pendiente.' }
  revalidateBilling()
  return { success: 'Cobro registrado.', advanceInvoiceId: saved.advance_invoice_id ?? null }
}

export async function setBillingPaymentOptionAction(_previous: BillingPaymentActionState, formData: FormData): Promise<BillingPaymentActionState> {
  await requireAdmin()
  const method = String(formData.get('method') ?? '')
  const parsed = paymentOptionSchema.safeParse({
    documentId: String(formData.get('document_id') ?? ''),
    method,
    url: method === 'manual_link' ? String(formData.get('payment_url') ?? '').trim() || null : null,
    instructions: String(formData.get('instructions') ?? '').trim() || null,
    active: String(formData.get('active') ?? '') === 'true',
  })
  if (!parsed.success) return { error: 'Revisa la forma de pago y sus instrucciones.' }
  const db = await createSupabaseServerClient()
  const { error } = await db.rpc('set_billing_payment_option', {
    p_document_id: parsed.data.documentId,
    p_method: parsed.data.method,
    p_url: parsed.data.url,
    p_instructions: parsed.data.instructions,
    p_active: parsed.data.active,
  })
  if (error) return { error: 'No se pudo actualizar la forma de pago.' }
  revalidateBilling()
  return { success: 'Forma de pago actualizada.' }
}

export async function reverseBillingPaymentAction(formData: FormData) {
  await requireAdmin()
  const paymentId = documentIdSchema.safeParse(String(formData.get('payment_id') ?? ''))
  if (!paymentId.success) return
  const db = await createSupabaseServerClient()
  await db.rpc('reverse_billing_payment', { p_payment_id: paymentId.data })
  revalidateBilling()
}
