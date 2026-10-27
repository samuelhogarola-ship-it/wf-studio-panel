import 'server-only'

import { requireAdmin } from '@/lib/auth'
import { collectAllRows, dateIdCursorFilter, type DateIdCursor } from '@/lib/supabase/pagination'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function getLedgerSummary({ from, to }: { from: string; to: string }) {
  await requireAdmin()
  const db = await createSupabaseServerClient()
  const [income, expenses] = await Promise.all([
    collectAllRows((cursor: DateIdCursor | null, limit) => {
      let query = db.from('ledger_income').select('*')
        .gte('occurred_on', from).lte('occurred_on', to)
        .order('occurred_on', { ascending: false }).order('id', { ascending: false }).limit(limit)
      if (cursor) query = query.or(dateIdCursorFilter('occurred_on', cursor, 'descending'))
      return query
    }, row => ({ date: row.occurred_on, id: row.id })),
    collectAllRows((cursor: DateIdCursor | null, limit) => {
      let query = db.from('ledger_expenses').select('*')
        .gte('occurred_on', from).lte('occurred_on', to)
        .order('occurred_on', { ascending: false }).order('id', { ascending: false }).limit(limit)
      if (cursor) query = query.or(dateIdCursorFilter('occurred_on', cursor, 'descending'))
      return query
    }, row => ({ date: row.occurred_on, id: row.id })),
  ])
  return {
    from, to, income, expenses,
    individualTotal: income.filter(entry => entry.source_mode === 'individual').reduce((sum, entry) => sum + entry.total_cents, 0),
    manualSummaryTotal: income.filter(entry => entry.source_mode === 'monthly_summary').reduce((sum, entry) => sum + entry.total_cents, 0),
    expenseTotal: expenses.reduce((sum, entry) => sum + entry.total_cents, 0),
    deductibleTaxTotal: expenses.reduce((sum, entry) => sum + entry.deductible_tax_cents, 0),
  }
}
