import { cache } from 'react'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export const getInvoicesPageData = cache(async () => {
  const supabase = await createSupabaseServerClient()

  const [{ data: clients }, { data: invoices }] = await Promise.all([
    supabase.from('clients').select('id, name, company, email, status').order('name'),
    supabase
      .from('invoices')
      .select('id, number, concept, amount, payment_method, status, notes, issued_at, paid_at, created_at, clients(name, company, email)')
      .order('issued_at', { ascending: false }),
  ])

  return {
    clients: clients ?? [],
    invoices: invoices ?? [],
  }
})

export const getInvoiceById = cache(async (id: string) => {
  const supabase = await createSupabaseServerClient()

  const { data } = await supabase
    .from('invoices')
    .select('id, number, concept, amount, payment_method, status, notes, issued_at, paid_at, clients(name, company, email)')
    .eq('id', id)
    .maybeSingle()

  return data
})
