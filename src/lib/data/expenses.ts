import { cache } from 'react'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export const getExpensesPageData = cache(async () => {
  const supabase = await createSupabaseServerClient()
  const [clientsResult, expensesResult] = await Promise.all([
    supabase.from('clients').select('id, name, status').eq('project', 'wf-studio').order('name'),
    supabase
      .from('expenses')
      .select('id, client_id, supplier, concept, category, accounting_area, amount, expense_date, payment_method, status, notes, clients(name)')
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(250),
  ])

  if (clientsResult.error) throw clientsResult.error
  if (expensesResult.error) throw expensesResult.error
  return { clients: clientsResult.data ?? [], expenses: expensesResult.data ?? [] }
})
