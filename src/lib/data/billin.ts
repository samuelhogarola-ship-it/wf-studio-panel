import { cache } from 'react'

import { summarizeBillin } from '@/lib/billin/summary.mjs'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const getBillinDashboardData = cache(async () => {
  const supabase = await createSupabaseServerClient()
  const [invoiceResult, expenseResult] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, number, concept, amount, status, document_type, accounting_area, issued_at')
      .order('issued_at', { ascending: false }),
    supabase
      .from('expenses')
      .select('id, supplier, concept, amount, status, accounting_area, expense_date')
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false }),
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

