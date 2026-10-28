import { cache } from 'react'

import { collectAllPages } from '@/lib/billin/pagination.mjs'
import { summarizeAccounts, summarizeBillin } from '@/lib/billin/summary.mjs'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type PeriodBounds = { start: string; end: string }

export const getBillinDashboardData = cache(async (period?: PeriodBounds) => {
  const supabase = await createSupabaseServerClient()
  const [invoices, collections, expenses, accounts] = await Promise.all([
    collectAllPages(async (from, to) => {
      let query = supabase.from('invoices').select('id, number, concept, amount, status, document_type, accounting_area, billing_account_id, issued_at, paid_at').order('issued_at', { ascending: false }).order('id', { ascending: false })
      if (period) query = query.gte('issued_at', period.start).lt('issued_at', period.end)
      const { data, error } = await query.range(from, to)
      if (error) throw error
      return data ?? []
    }),
    collectAllPages(async (from, to) => {
      let query = supabase.from('invoices').select('id, number, concept, amount, status, document_type, accounting_area, billing_account_id, issued_at, paid_at').eq('status', 'paid').order('paid_at', { ascending: false }).order('id', { ascending: false })
      if (period) query = query.gte('paid_at', period.start).lt('paid_at', period.end)
      const { data, error } = await query.range(from, to)
      if (error) throw error
      return data ?? []
    }),
    collectAllPages(async (from, to) => {
      let query = supabase.from('expenses').select('id, supplier, concept, amount, status, accounting_area, billing_account_id, expense_date').order('expense_date', { ascending: false }).order('id', { ascending: false })
      if (period) query = query.gte('expense_date', period.start).lt('expense_date', period.end)
      const { data, error } = await query.range(from, to)
      if (error) throw error
      return data ?? []
    }),
    collectAllPages(async (from, to) => {
      const { data, error } = await supabase.from('billing_accounts').select('id, name, account_type, details, status').order('name').order('id').range(from, to)
      if (error) throw error
      return data ?? []
    }),
  ])
  return {
    summary: summarizeBillin({ invoices, collections, expenses }),
    accountBreakdown: summarizeAccounts({ accounts, collections, expenses }),
    recentInvoices: invoices.slice(0, 10),
    recentExpenses: expenses.slice(0, 10),
  }
})
export const getBillinPeriodData = cache(async (period: PeriodBounds) => {
  const supabase = await createSupabaseServerClient()
  const [invoices, collections, expenses] = await Promise.all([
    collectAllPages(async (from, to) => {
      const { data, error } = await supabase.from('invoices').select('id, number, concept, amount, status, document_type, accounting_area, billing_account_id, issued_at, paid_at').gte('issued_at', period.start).lt('issued_at', period.end).order('issued_at', { ascending: true }).order('id').range(from, to)
      if (error) throw error
      return data ?? []
    }),
    collectAllPages(async (from, to) => {
      const { data, error } = await supabase.from('invoices').select('id, number, concept, amount, status, document_type, accounting_area, billing_account_id, issued_at, paid_at').eq('status', 'paid').gte('paid_at', period.start).lt('paid_at', period.end).order('paid_at', { ascending: true }).order('id').range(from, to)
      if (error) throw error
      return data ?? []
    }),
    collectAllPages(async (from, to) => {
      const { data, error } = await supabase.from('expenses').select('id, supplier, concept, amount, status, accounting_area, billing_account_id, expense_nature, expense_date').gte('expense_date', period.start).lt('expense_date', period.end).order('expense_date', { ascending: true }).order('id').range(from, to)
      if (error) throw error
      return data ?? []
    }),
  ])
  return { summary: summarizeBillin({ invoices, collections, expenses }), invoices, collections, expenses }
})
export const getBillingAccounts = cache(async () => {
  const supabase = await createSupabaseServerClient()
  return collectAllPages(async (from, to) => {
    const { data, error } = await supabase.from('billing_accounts').select('id, name, account_type, details, status').order('name').order('id').range(from, to)
    if (error) throw error
    return data ?? []
  })
})
