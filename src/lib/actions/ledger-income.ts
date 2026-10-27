'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { ledgerIncomeInputSchema } from '@/lib/billing/schema'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type LedgerIncomeActionState = { error?: string; success?: string }

export async function createIncomeAction(_previous: LedgerIncomeActionState, formData: FormData): Promise<LedgerIncomeActionState> {
  await requireAdmin()
  const taxMode = String(formData.get('tax_mode') ?? '')
  const parsed = ledgerIncomeInputSchema.safeParse({
    category: formData.get('category'), description: formData.get('description'), occurredOn: formData.get('occurred_on'),
    sourceMode: formData.get('source_mode'), netCents: Math.round(Number(formData.get('net_euros')) * 100), taxMode,
    taxRateBps: taxMode === 'taxable' ? Math.round(Number(formData.get('tax_rate')) * 100) : 0,
  })
  if (!parsed.success) return { error: 'Revisa la fecha, categoría, importe e IVA del ingreso.' }
  const db = await createSupabaseServerClient()
  const { error } = await db.rpc('create_ledger_income', {
    p_category: parsed.data.category, p_description: parsed.data.description, p_occurred_on: parsed.data.occurredOn,
    p_source_mode: parsed.data.sourceMode, p_net_cents: parsed.data.netCents, p_tax_mode: parsed.data.taxMode, p_tax_rate_bps: parsed.data.taxRateBps,
  })
  if (error) return { error: 'No se pudo registrar el ingreso.' }
  revalidatePath('/paneladmin/contabilidad')
  return { success: 'Ingreso registrado.' }
}
