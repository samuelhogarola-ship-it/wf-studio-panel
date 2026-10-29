import { cache } from 'react'

import { collectAllPages } from '@/lib/billin/pagination.mjs'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const getExpensesPageData = cache(async ({ area, page, pageSize = 50, start, end }: { area: 'general' | 'classes' | null; page: number; pageSize?: number; start?: string; end?: string }) => {
  const supabase = await createSupabaseServerClient()
  let expensesQuery = supabase
    .from('expenses')
    .select('id, client_id, supplier, concept, category, accounting_area, expense_nature, billing_account_id, amount, expense_date, payment_method, status, notes, clients(name)', { count: 'exact' })
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (area) expensesQuery = expensesQuery.eq('accounting_area', area)
  if (start && end) expensesQuery = expensesQuery.gte('expense_date', start).lt('expense_date', end)
  expensesQuery = expensesQuery.range(page * pageSize, page * pageSize + pageSize - 1)

  const summaryPromise = start && end
    ? collectAllPages(async (from, to) => {
      let query = supabase.from('expenses').select('amount, status').eq('status', 'paid')
      if (area) query = query.eq('accounting_area', area)
      query = query.gte('expense_date', start).lt('expense_date', end)
      const { data, error } = await query.order('expense_date', { ascending: false }).range(from, to)
      if (error) throw error
      return data ?? []
    }).then((rows) => ({ data: [{ total: rows.reduce((total, row) => total + Number(row.amount), 0) }], error: null }))
    : supabase.rpc('get_expense_ledger_summary', { p_area: area })

  const [clientsResult, accountsResult, expensesResult, summaryResult] = await Promise.all([
    supabase.from('clients').select('id, name, status').eq('project', 'wf-studio').order('name'),
    supabase.from('billing_accounts').select('id, name, account_type, status').order('name'),
    expensesQuery,
    summaryPromise,
  ])

  if (clientsResult.error) throw clientsResult.error
  if (accountsResult.error) throw accountsResult.error
  if (expensesResult.error) throw expensesResult.error
  if (summaryResult.error) throw summaryResult.error
  const summary = Array.isArray(summaryResult.data) ? summaryResult.data[0] : summaryResult.data
  return {
    clients: clientsResult.data ?? [],
    accounts: accountsResult.data ?? [],
    expenses: expensesResult.data ?? [],
    count: expensesResult.count ?? 0,
    total: Number(summary?.total ?? 0),
    page,
    pageSize,
  }
})
