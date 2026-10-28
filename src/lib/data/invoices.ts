import { cache } from 'react'

import { collectAllPages } from '@/lib/billin/pagination.mjs'
import { monthBounds } from '@/lib/billin/periods.mjs'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type InvoiceFilters = { month?: string; type?: string; status?: string; area?: string; page?: string }

export const getInvoicesPageData = cache(async (filters: InvoiceFilters = {}) => {
  const supabase = await createSupabaseServerClient()
  const pageSize = 100
  const page = Math.max(1, Number.parseInt(filters.page ?? '1', 10) || 1)
  let invoicesQuery = supabase
    .from('invoices')
    .select('id, number, concept, amount, payment_method, status, notes, issued_at, paid_at, created_at, recipient_kind, recipient_name, recipient_email, recipient_company, document_type, accounting_area, billing_account_id, transfer_instructions, clients(name, company, email)', { count: 'exact' })
    .order('issued_at', { ascending: false }).order('id', { ascending: false })

  if (filters.month) {
    const period = monthBounds(filters.month)
    invoicesQuery = invoicesQuery.gte('issued_at', period.start).lt('issued_at', period.end)
  }
  if (filters.type === 'invoice' || filters.type === 'proposal') invoicesQuery = invoicesQuery.eq('document_type', filters.type)
  if (['draft', 'issued', 'paid', 'void'].includes(filters.status ?? '')) invoicesQuery = invoicesQuery.eq('status', filters.status as string)
  if (filters.area === 'general' || filters.area === 'classes') invoicesQuery = invoicesQuery.eq('accounting_area', filters.area)
  invoicesQuery = invoicesQuery.range((page - 1) * pageSize, page * pageSize - 1)

  const [{ data: clients }, { data: accounts }, invoiceResult, totalRows] = await Promise.all([
    supabase.from('clients').select('id, name, company, email, status').order('name'),
    supabase.from('billing_accounts').select('id, name, account_type, status').order('name'),
    invoicesQuery,
    collectAllPages(async (from, to) => {
      let query = supabase.from('invoices').select('amount, status, document_type').order('issued_at', { ascending: false }).order('id', { ascending: false })
      if (filters.month) {
        const period = monthBounds(filters.month)
        query = query.gte('issued_at', period.start).lt('issued_at', period.end)
      }
      if (filters.type === 'invoice' || filters.type === 'proposal') query = query.eq('document_type', filters.type)
      if (['draft', 'issued', 'paid', 'void'].includes(filters.status ?? '')) query = query.eq('status', filters.status as string)
      if (filters.area === 'general' || filters.area === 'classes') query = query.eq('accounting_area', filters.area)
      const { data, error } = await query.range(from, to)
      if (error) throw error
      return data ?? []
    }),
  ])

  if (invoiceResult.error) throw invoiceResult.error
  const invoiceRows = invoiceResult.data ?? []
  return {
    clients: clients ?? [],
    accounts: accounts ?? [],
    invoices: invoiceRows,
    filteredTotal: totalRows.reduce((total, invoice) => invoice.document_type === 'invoice' && (invoice.status === 'issued' || invoice.status === 'paid') ? total + Number(invoice.amount) : total, 0),
    count: invoiceResult.count ?? invoiceRows.length,
    page,
    pageSize,
  }
})

export const getInvoiceById = cache(async (id: string) => {
  const supabase = await createSupabaseServerClient()

  const { data } = await supabase
    .from('invoices')
    .select('id, number, concept, amount, payment_method, status, notes, issued_at, paid_at, recipient_kind, recipient_name, recipient_email, recipient_company, document_type, accounting_area, transfer_instructions, clients(name, company, email)')
    .eq('id', id)
    .maybeSingle()

  return data
})
