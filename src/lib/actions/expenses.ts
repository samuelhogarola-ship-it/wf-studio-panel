'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireAdmin } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type ExpenseFormState = { error?: string; success?: string }

const expenseSchema = z.object({
  client_id: z.string().uuid().nullable(),
  supplier: z.string().trim().min(1).max(200),
  concept: z.string().trim().min(1).max(500),
  category: z.enum(['software', 'services', 'taxes', 'travel', 'office', 'marketing', 'classes', 'other']),
  accounting_area: z.enum(['general', 'classes']),
  amount: z.number().positive().finite(),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payment_method: z.enum(['transfer', 'card', 'cash', 'direct_debit', 'other']),
  status: z.enum(['paid', 'pending']),
  notes: z.string().trim().max(2000).nullable(),
})

export async function createExpenseAction(_previous: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  const identity = await requireAdmin()
  const clientId = String(formData.get('client_id') ?? '').trim() || null
  const parsed = expenseSchema.safeParse({
    client_id: clientId,
    supplier: formData.get('supplier'),
    concept: formData.get('concept'),
    category: formData.get('category'),
    accounting_area: formData.get('accounting_area'),
    amount: Number(formData.get('amount')),
    expense_date: formData.get('expense_date'),
    payment_method: formData.get('payment_method'),
    status: formData.get('status'),
    notes: String(formData.get('notes') ?? '').trim() || null,
  })

  if (!parsed.success) return { error: 'Revisa proveedor, concepto, importe, fecha y categoría.' }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('expenses').insert({
    ...parsed.data,
    created_by: identity.userId,
  })
  if (error) return { error: 'No se pudo registrar el gasto.' }

  revalidatePath('/paneladmin/gastos')
  if (parsed.data.client_id) revalidatePath(`/paneladmin/clientes/${parsed.data.client_id}`)
  return { success: 'Gasto registrado correctamente.' }
}
