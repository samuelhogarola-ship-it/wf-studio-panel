'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireAdmin } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type BillingAccountFormState = { error?: string; success?: string }

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  account_type: z.enum(['bank', 'stripe', 'cash', 'other']),
  details: z.string().trim().max(500).nullable(),
})

export async function createBillingAccountAction(_state: BillingAccountFormState, formData: FormData): Promise<BillingAccountFormState> {
  const identity = await requireAdmin()
  const parsed = schema.safeParse({ name: formData.get('name'), account_type: formData.get('account_type'), details: String(formData.get('details') ?? '').trim() || null })
  if (!parsed.success) return { error: 'Revisa el nombre y el tipo de cuenta.' }
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('billing_accounts').insert({ ...parsed.data, created_by: identity.userId })
  if (error) return { error: 'No se pudo guardar la cuenta.' }
  revalidatePath('/paneladmin/billin/cuentas')
  revalidatePath('/paneladmin/billin')
  revalidatePath('/paneladmin/facturas')
  revalidatePath('/paneladmin/gastos')
  return { success: 'Cuenta guardada correctamente.' }
}
