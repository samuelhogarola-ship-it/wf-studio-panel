'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type InvoiceFormState = {
  error?: string
  success?: string
}

export async function createInvoiceAction(prevState: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()

  const client_id = String(formData.get('client_id') ?? '')
  const concept = String(formData.get('concept') ?? '').trim()
  const amountRaw = formData.get('amount')
  const payment_method = String(formData.get('payment_method') ?? '')
  const notes = String(formData.get('notes') ?? '').trim() || null
  const issued_at = String(formData.get('issued_at') ?? '') || new Date().toISOString().slice(0, 10)

  if (!client_id || !concept || !amountRaw || !payment_method) {
    return { error: 'Rellena todos los campos obligatorios.' }
  }

  const amount = Number(amountRaw)
  if (Number.isNaN(amount) || amount <= 0) {
    return { error: 'El importe debe ser mayor que 0.' }
  }

  if (!['cash', 'card', 'transfer'].includes(payment_method)) {
    return { error: 'Método de pago no válido.' }
  }

  // Get auto-generated invoice number
  const { data: numberData, error: rpcError } = await supabase.rpc('next_invoice_number')
  if (rpcError || !numberData) {
    return { error: 'No se pudo generar el número de factura.' }
  }

  const { error } = await supabase.from('invoices').insert({
    client_id,
    number: numberData as string,
    concept,
    amount,
    payment_method: payment_method as 'cash' | 'card' | 'transfer',
    notes,
    issued_at,
  })

  if (error) {
    return { error: 'No se pudo crear la factura.' }
  }

  revalidatePath('/paneladmin/facturas')
  return { success: `Factura ${numberData} creada correctamente.` }
}

export async function markInvoicePaidAction(formData: FormData) {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()

  const id = String(formData.get('id') ?? '')
  if (!id) return

  await supabase
    .from('invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString().slice(0, 10) })
    .eq('id', id)

  revalidatePath('/paneladmin/facturas')
}

export async function deleteInvoiceAction(formData: FormData) {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()

  const id = String(formData.get('id') ?? '')
  if (!id) return

  await supabase.from('invoices').delete().eq('id', id)

  revalidatePath('/paneladmin/facturas')
}
