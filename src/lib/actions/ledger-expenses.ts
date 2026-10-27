'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { ledgerExpenseInputSchema } from '@/lib/billing/schema'
import { expenseAttachmentExtension, validateExpenseAttachment } from '@/lib/data/expense-attachments'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type LedgerExpenseActionState = { error?: string; success?: string }
const euros = (value: FormDataEntryValue | null) => Math.round(Number(value) * 100)

export async function createExpenseAction(_previous: LedgerExpenseActionState, formData: FormData): Promise<LedgerExpenseActionState> {
  await requireAdmin()
  const parsed = ledgerExpenseInputSchema.safeParse({
    supplierName: formData.get('supplier_name'), supplierTaxId: String(formData.get('supplier_tax_id') ?? '').trim() || null,
    invoiceReference: String(formData.get('invoice_reference') ?? '').trim() || null, category: formData.get('category'), occurredOn: formData.get('occurred_on'),
    netCents: euros(formData.get('net_euros')), taxRateBps: Math.round(Number(formData.get('tax_rate')) * 100), taxCents: euros(formData.get('tax_euros')),
    deductibleTaxCents: euros(formData.get('deductible_tax_euros')), totalCents: euros(formData.get('total_euros')),
    paymentMethod: formData.get('payment_method'), notes: String(formData.get('notes') ?? '').trim() || null,
  })
  if (!parsed.success) return { error: 'Revisa proveedor, fecha, importes e IVA deducible.' }

  const file = formData.get('attachment')
  let storagePath: string | null = null
  let originalName: string | null = null
  let contentType: string | null = null
  let sizeBytes: number | null = null
  let bytes: Uint8Array | null = null
  if (file instanceof File && file.size > 0) {
    bytes = new Uint8Array(await file.arrayBuffer())
    const validation = validateExpenseAttachment(bytes, file.type, file.size)
    if (!validation.valid) return { error: validation.error }
    const extension = expenseAttachmentExtension(file.type)
    storagePath = `receipts/${randomUUID()}.${extension}`
    originalName = file.name.slice(0, 240)
    contentType = file.type
    sizeBytes = file.size
  }

  const db = await createSupabaseServerClient()
  if (storagePath && bytes && contentType) {
    const { error } = await db.storage.from('expense-attachments').upload(storagePath, bytes, { contentType, upsert: false })
    if (error) return { error: 'No se pudo guardar el justificante.' }
  }
  const value = parsed.data
  const { error } = await db.rpc('create_ledger_expense', {
    p_supplier_name: value.supplierName, p_supplier_tax_id: value.supplierTaxId ?? null, p_invoice_reference: value.invoiceReference ?? null,
    p_category: value.category, p_occurred_on: value.occurredOn, p_net_cents: value.netCents, p_tax_rate_bps: value.taxRateBps,
    p_tax_cents: value.taxCents, p_deductible_tax_cents: value.deductibleTaxCents, p_total_cents: value.totalCents,
    p_payment_method: value.paymentMethod, p_notes: value.notes ?? null, p_storage_path: storagePath,
    p_original_name: originalName, p_content_type: contentType, p_size_bytes: sizeBytes,
  })
  if (error) {
    if (storagePath) await db.storage.from('expense-attachments').remove([storagePath])
    return { error: 'No se pudo registrar el gasto.' }
  }
  revalidatePath('/paneladmin/contabilidad')
  return { success: 'Gasto registrado.' }
}
