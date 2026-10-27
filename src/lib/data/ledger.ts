import 'server-only'

import { requireAdmin } from '@/lib/auth'
import { calculateAccountingSummary } from '@/lib/billing/calculations'
import { collectAllRows, dateIdCursorFilter, type DateIdCursor } from '@/lib/supabase/pagination'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function getLedgerSummary({ from, to }: { from: string; to: string }) {
  await requireAdmin()
  const db = await createSupabaseServerClient()
  const [income, expenses, paymentsThroughPeriod, documents] = await Promise.all([
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
    collectAllRows((cursor: DateIdCursor | null, limit) => {
      let query = db.from('billing_payments').select('*').is('reversed_at', null).lte('paid_on', to)
        .order('paid_on').order('id').limit(limit)
      if (cursor) query = query.or(dateIdCursorFilter('paid_on', cursor))
      return query
    }, row => ({ date: row.paid_on, id: row.id })),
    collectAllRows((cursor: DateIdCursor | null, limit) => {
      let query = db.from('billing_documents').select('id, total_cents, document_date').in('status', ['issued', 'paid'])
        .gte('document_date', from).lte('document_date', to).order('document_date').order('id').limit(limit)
      if (cursor) query = query.or(dateIdCursorFilter('document_date', cursor))
      return query
    }, row => ({ date: row.document_date, id: row.id })),
  ])
  const accounting = calculateAccountingSummary(from, income, expenses, paymentsThroughPeriod, documents)
  return {
    from, to, income, expenses, ...accounting,
    individualTotal: income.filter(entry => entry.source_mode === 'individual').reduce((sum, entry) => sum + entry.total_cents, 0),
    manualSummaryTotal: income.filter(entry => entry.source_mode === 'monthly_summary').reduce((sum, entry) => sum + entry.total_cents, 0),
  }
}
