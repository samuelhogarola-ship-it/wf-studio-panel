import 'server-only'

import { requireAdmin } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function getLedgerSummary({ from, to }: { from: string; to: string }) {
  await requireAdmin()
  const db = await createSupabaseServerClient()
  const { data } = await db.from('ledger_income').select('*').order('occurred_on', { ascending: false })
  const income = (data ?? []).filter(entry => entry.occurred_on >= from && entry.occurred_on <= to)
  return {
    from, to, income,
    individualTotal: income.filter(entry => entry.source_mode === 'individual').reduce((sum, entry) => sum + entry.total_cents, 0),
    manualSummaryTotal: income.filter(entry => entry.source_mode === 'monthly_summary').reduce((sum, entry) => sum + entry.total_cents, 0),
  }
}
