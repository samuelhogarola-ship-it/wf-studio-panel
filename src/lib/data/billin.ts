import { cache } from 'react'

import { summarizeBillin } from '@/lib/billin/summary.mjs'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type PeriodBounds = { start: string; end: string }

export const getBillinDashboardData = cache(async (period?: PeriodBounds) => {
  const supabase = await createSupabaseServerClient()
  let invoiceQuery = supabase
    .from('invoices')
    .select('id, number, concept, amount, status, document_type, accounting_area, issued_at')
    .order('issued_at', { ascending: false })
  let expenseQuery = supabase
    .from('expenses')
    .select('id, supplier, concept, amount, status, accounting_area, expense_date')
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (period) {
    invoiceQuery = invoiceQuery.gte('issued_at', period.start).lt('issued_at', period.end)
    expenseQuery = expenseQuery.gte('expense_date', period.start).lt('expense_date', period.end)
  }
  const [invoiceResult, expenseResult] = await Promise.all([
    invoiceQuery,
    expenseQuery,
  ])

  if (invoiceResult.error) throw invoiceResult.error
  if (expenseResult.error) throw expenseResult.error

  const invoices = invoiceResult.data ?? []
  const expenses = expenseResult.data ?? []
  return {
    summary: summarizeBillin({ invoices, expenses }),
    recentInvoices: invoices.slice(0, 6),
    recentExpenses: expenses.slice(0, 6),
  }
})

export const getBillinPeriodData = cache(async (period: PeriodBounds) => {
  const supabase = await createSupabaseServerClient()
  const [invoiceResult, expenseResult] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, number, concept, amount, status, document_type, accounting_area, issued_at')
      .gte('issued_at', period.start)
      .lt('issued_at', period.end)
      .order('issued_at', { ascending: true }),
    supabase
      .from('expenses')
      .select('id, supplier, concept, amount, status, accounting_area, expense_nature, expense_date')
      .gte('expense_date', period.start)
      .lt('expense_date', period.end)
      .order('expense_date', { ascending: true }),
  ])
  if (invoiceResult.error) throw invoiceResult.error
  if (expenseResult.error) throw expenseResult.error
  const invoices = invoiceResult.data ?? []
  const expenses = expenseResult.data ?? []
  return { summary: summarizeBillin({ invoices, expenses }), invoices, expenses }
})

