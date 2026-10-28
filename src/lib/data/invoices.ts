import { cache } from 'react'

import { monthBounds } from '@/lib/billin/periods.mjs'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type InvoiceFilters = { month?: string; type?: string; status?: string; area?: string }

export const getInvoicesPageData = cache(async (filters: InvoiceFilters = {}) => {
  const supabase = await createSupabaseServerClient()
  let invoicesQuery = supabase
    .from('invoices')
    .select('id, number, concept, amount, payment_method, status, notes, issued_at, paid_at, created_at, recipient_kind, recipient_name, recipient_email, recipient_company, document_type, accounting_area, transfer_instructions, clients(name, company, email)')
    .order('issued_at', { ascending: false })

  if (filters.month) {
    const period = monthBounds(filters.month)
    invoicesQuery = invoicesQuery.gte('issued_at', period.start).lt('issued_at', period.end)
  }
  if (filters.type === 'invoice' || filters.type === 'proposal') invoicesQuery = invoicesQuery.eq('document_type', filters.type)
  if (['issued', 'paid', 'void'].includes(filters.status ?? '')) invoicesQuery = invoicesQuery.eq('status', filters.status as string)
  if (filters.area === 'general' || filters.area === 'classes') invoicesQuery = invoicesQuery.eq('accounting_area', filters.area)

  const [{ data: clients }, { data: invoices }] = await Promise.all([
    supabase.from('clients').select('id, name, company, email, status').order('name'),
    invoicesQuery,
  ])

  const invoiceRows = invoices ?? []
  return {
    clients: clients ?? [],
    invoices: invoiceRows,
    filteredTotal: invoiceRows.reduce((total, invoice) => invoice.document_type === 'invoice' && invoice.status !== 'void' ? total + Number(invoice.amount) : total, 0),
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
