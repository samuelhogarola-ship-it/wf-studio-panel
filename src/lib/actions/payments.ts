'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireAdmin } from '@/lib/auth'
import { parseStripePaymentLink } from '@/lib/payments/schema'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type PaymentActionState = { error?: string; success?: string }

const requestSchema = z.object({
  clientId: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(200),
  email: z.string().email().max(320),
  company: z.string().trim().max(200).nullable(),
  concept: z.string().trim().min(1).max(500),
  amount: z.number().finite().positive().max(10_000_000),
})

export async function createPaymentRequestAction(_prev: PaymentActionState, formData: FormData): Promise<PaymentActionState> {
  const identity = await requireAdmin()
  const clientIdRaw = String(formData.get('client_id') ?? '').trim()
  const db = await createSupabaseServerClient()
  let recipient = {
    clientId: clientIdRaw || null,
    name: String(formData.get('recipient_name') ?? ''),
    email: String(formData.get('recipient_email') ?? ''),
    company: String(formData.get('recipient_company') ?? '').trim() || null,
  }
  if (clientIdRaw) {
    const { data: client, error } = await db.from('clients').select('id, name, email, company, project, status').eq('id', clientIdRaw).maybeSingle()
    if (error || !client || client.project !== 'wf-studio' || client.status !== 'active') return { error: 'Cliente no disponible.' }
    recipient = { clientId: client.id, name: client.name, email: client.email, company: client.company }
  }
  const parsed = requestSchema.safeParse({
    ...recipient,
    concept: String(formData.get('concept') ?? ''),
    amount: Number(formData.get('amount')),
  })
  if (!parsed.success) return { error: 'Revisa destinatario, concepto e importe.' }
  const { error } = await db.from('payment_requests').insert({
    client_id: parsed.data.clientId,
    recipient_name: parsed.data.name,
    recipient_email: parsed.data.email.toLowerCase(),
    recipient_company: parsed.data.company,
    concept: parsed.data.concept,
    amount: parsed.data.amount,
    created_by: identity.userId,
  })
  if (error) return { error: 'No se pudo crear la solicitud de pago.' }
  revalidatePath('/paneladmin/pagos')
  revalidatePath('/cliente/pagos')
  return { success: 'Solicitud de pago creada.' }
}

export async function attachPaymentLinkAction(_prev: PaymentActionState, formData: FormData): Promise<PaymentActionState> {
  const identity = await requireAdmin()
  const requestId = String(formData.get('payment_request_id') ?? '')
  const parsed = parseStripePaymentLink(formData.get('url'))
  if (!z.string().uuid().safeParse(requestId).success || !parsed.success) return { error: 'Enlace de pago no válido.' }
  const db = await createSupabaseServerClient()
  const { error } = await db.from('payment_links').insert({ payment_request_id: requestId, url: parsed.data, created_by: identity.userId })
  if (error) return { error: 'No se pudo guardar el enlace de pago.' }
  revalidatePath('/paneladmin/pagos')
  revalidatePath('/cliente/pagos')
  return { success: 'Enlace de pago guardado.' }
}
