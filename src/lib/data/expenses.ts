import { cache } from 'react'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export const getExpensesPageData = cache(async ({ area, page, pageSize = 50 }: { area: 'general' | 'classes' | null; page: number; pageSize?: number }) => {
  const supabase = await createSupabaseServerClient()
  let expensesQuery = supabase
    .from('expenses')
    .select('id, client_id, supplier, concept, category, accounting_area, expense_nature, amount, expense_date, payment_method, status, notes, clients(name)', { count: 'exact' })
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (area) expensesQuery = expensesQuery.eq('accounting_area', area)
  expensesQuery = expensesQuery.range(page * pageSize, page * pageSize + pageSize - 1)

  const [clientsResult, expensesResult, summaryResult] = await Promise.all([
    supabase.from('clients').select('id, name, status').eq('project', 'wf-studio').order('name'),
    expensesQuery,
    supabase.rpc('get_expense_ledger_summary', { p_area: area }),
  ])

  if (clientsResult.error) throw clientsResult.error
  if (expensesResult.error) throw expensesResult.error
  if (summaryResult.error) throw summaryResult.error
  const summary = Array.isArray(summaryResult.data) ? summaryResult.data[0] : summaryResult.data
  return {
    clients: clientsResult.data ?? [],
    expenses: expensesResult.data ?? [],
    count: expensesResult.count ?? 0,
    total: Number(summary?.total ?? 0),
    page,
    pageSize,
  }
})
