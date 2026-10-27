'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireAdmin } from '@/lib/auth'
import { billingLineInputSchema, billingProductInputSchema } from '@/lib/billing/schema'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type BillingDocumentActionState = { error?: string; success?: string; documentId?: string }

const uuidOrNull = z.union([z.string().uuid(), z.null()])
const documentSchema = z.object({
  id: uuidOrNull,
  documentType: z.enum(['proposal', 'invoice', 'advance_invoice']),
  clientId: uuidOrNull,
  recipientName: z.string().trim().max(200),
  recipientEmail: z.union([z.string().email().max(320), z.literal('')]),
  recipientCompany: z.string().trim().max(200).nullable(),
  title: z.string().trim().min(1).max(300),
  notes: z.string().trim().max(5_000).nullable(),
  documentDate: z.string().date(),
  dueDate: z.string().date().nullable(),
  sourceProposalId: uuidOrNull,
  parentInvoiceId: uuidOrNull,
  lines: z.array(billingLineInputSchema).min(1).max(50),
}).superRefine((value, context) => {
  if (!value.clientId && (!value.recipientName || !value.recipientEmail)) {
    context.addIssue({ code: 'custom', path: ['recipientName'], message: 'El destinatario externo necesita nombre y email.' })
  }
})

function refresh() {
  revalidatePath('/paneladmin/contabilidad')
  revalidatePath('/paneladmin/contabilidad/productos')
  revalidatePath('/cliente/facturas')
}

export async function saveBillingProductAction(_previous: BillingDocumentActionState, formData: FormData): Promise<BillingDocumentActionState> {
  await requireAdmin()
  const rawPrice = String(formData.get('default_price') ?? '').trim()
  const parsed = billingProductInputSchema.safeParse({
    name: formData.get('name'),
    description: String(formData.get('description') ?? '').trim() || null,
    defaultNetCents: rawPrice ? Math.round(Number(rawPrice) * 100) : null,
    taxMode: formData.get('tax_mode'),
    taxRateBps: Math.round(Number(formData.get('tax_rate')) * 100),
    active: String(formData.get('active') ?? '') === 'true',
  })
  const id = uuidOrNull.safeParse(String(formData.get('id') ?? '').trim() || null)
  if (!parsed.success || !id.success) return { error: 'Revisa el nombre, precio e IVA del producto.' }
  const db = await createSupabaseServerClient()
  const { error } = await db.rpc('save_billing_product', {
    p_id: id.data,
    p_name: parsed.data.name,
    p_description: parsed.data.description ?? null,
    p_default_net_cents: parsed.data.defaultNetCents,
    p_tax_mode: parsed.data.taxMode,
    p_tax_rate_bps: parsed.data.taxRateBps,
    p_active: parsed.data.active,
    p_sort_order: Number(formData.get('sort_order') ?? 0),
  })
  if (error) return { error: 'No se pudo guardar el producto. Comprueba que el nombre no esté repetido.' }
  refresh()
  return { success: 'Producto guardado.' }
}

export async function deleteBillingProductAction(formData: FormData) {
  await requireAdmin()
  const id = z.string().uuid().safeParse(String(formData.get('id') ?? ''))
  if (!id.success) return
  const db = await createSupabaseServerClient()
  const { data, error } = await db.rpc('delete_billing_product', { p_id: id.data })
  if (error || data !== true) throw new Error('No se pudo borrar el producto.')
  refresh()
}

export async function saveBillingDocumentAction(_previous: BillingDocumentActionState, formData: FormData): Promise<BillingDocumentActionState> {
  await requireAdmin()
  let rawLines: unknown
  try { rawLines = JSON.parse(String(formData.get('lines_json') ?? '[]')) } catch { return { error: 'Las líneas del documento no son válidas.' } }
  const parsed = documentSchema.safeParse({
    id: String(formData.get('id') ?? '').trim() || null,
    documentType: formData.get('document_type'),
    clientId: String(formData.get('client_id') ?? '').trim() || null,
    recipientName: formData.get('recipient_name'),
    recipientEmail: formData.get('recipient_email'),
    recipientCompany: String(formData.get('recipient_company') ?? '').trim() || null,
    title: formData.get('title'),
    notes: String(formData.get('notes') ?? '').trim() || null,
    documentDate: formData.get('document_date'),
    dueDate: String(formData.get('due_date') ?? '').trim() || null,
    sourceProposalId: String(formData.get('source_proposal_id') ?? '').trim() || null,
    parentInvoiceId: String(formData.get('parent_invoice_id') ?? '').trim() || null,
    lines: rawLines,
  })
  if (!parsed.success) return { error: 'Revisa destinatario, fechas y líneas del documento.' }
  const db = await createSupabaseServerClient()
  const { data, error } = await db.rpc('save_billing_document_draft', {
    p_id: parsed.data.id,
    p_document_type: parsed.data.documentType,
    p_client_id: parsed.data.clientId,
    p_recipient_name: parsed.data.recipientName,
    p_recipient_email: parsed.data.recipientEmail,
    p_recipient_company: parsed.data.recipientCompany,
    p_title: parsed.data.title,
    p_notes: parsed.data.notes,
    p_document_date: parsed.data.documentDate,
    p_due_date: parsed.data.dueDate,
    p_source_proposal_id: parsed.data.sourceProposalId,
    p_parent_invoice_id: parsed.data.parentInvoiceId,
    p_lines: parsed.data.lines.map(line => ({
      product_id: line.productId ?? null,
      product_name: line.productName ?? null,
      description: line.description,
      quantity: line.quantity,
      unit_net_cents: line.unitNetCents,
      tax_mode: line.taxMode,
      tax_rate_bps: line.taxRateBps,
    })),
  })
  const saved = Array.isArray(data) ? data[0] : data
  if (error || !saved?.id) return { error: 'No se pudo guardar el borrador.' }
  refresh()
  return { success: 'Borrador guardado.', documentId: saved.id }
}

export async function issueBillingDocumentAction(formData: FormData) {
  await requireAdmin()
  const id = z.string().uuid().safeParse(String(formData.get('document_id') ?? ''))
  if (!id.success) return
  const db = await createSupabaseServerClient()
  const { error } = await db.rpc('issue_billing_document', { p_document_id: id.data })
  if (error) throw new Error('No se pudo emitir el documento.')
  refresh()
}
