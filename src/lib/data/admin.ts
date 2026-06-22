import { cache } from 'react'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { normalizeSearch } from '@/lib/utils'

export const getAdminDashboardData = cache(async () => {
  const supabase = await createSupabaseServerClient()

  const [{ count: activeClients }, { data: summaries }, { count: activePacks }, { count: monthActivities }, { data: recentActivities }] =
    await Promise.all([
      supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('client_summary').select('*'),
      supabase.from('packs').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .gte('work_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)),
      supabase
        .from('activities')
        .select('id, title, hours_used, work_date, clients(name), packs(name)')
        .order('work_date', { ascending: false })
        .limit(6),
    ])

  const pendingHours =
    summaries?.reduce((sum, item) => {
      return sum + Number(item.remaining_hours ?? 0)
    }, 0) ?? 0

  return {
    activeClients: activeClients ?? 0,
    pendingHours,
    activePacks: activePacks ?? 0,
    monthActivities: monthActivities ?? 0,
    recentActivities: recentActivities ?? [],
  }
})

export const getAdminClientsPageData = cache(async (search: string, editingId?: string) => {
  const supabase = await createSupabaseServerClient()
  const query = normalizeSearch(search)

  let clientsQuery = supabase
    .from('clients')
    .select('id, name, company, email, phone, status, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (query) {
    clientsQuery = clientsQuery.or(`name.ilike.%${query}%,company.ilike.%${query}%,email.ilike.%${query}%`)
  }

  const [{ data: clients }, { data: editingClient }, { data: summaries }] = await Promise.all([
    clientsQuery,
    editingId
      ? supabase
          .from('clients')
          .select('id, name, company, email, phone, status')
          .eq('id', editingId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('client_summary').select('*'),
  ])

  return {
    clients: clients ?? [],
    editingClient,
    summaries: summaries ?? [],
  }
})

export const getAdminPacksPageData = cache(async (editingId?: string) => {
  const supabase = await createSupabaseServerClient()

  const [{ data: clients }, { data: packs }, { data: packSummaries }, { data: editingPack }] = await Promise.all([
    supabase.from('clients').select('id, name, email, status').order('name'),
    supabase
      .from('packs')
      .select('id, name, client_id, hours_total, price, invoice_number, purchase_date, status, notes, clients(name)')
      .order('purchase_date', { ascending: false }),
    supabase.from('pack_summary').select('*'),
    editingId
      ? supabase
          .from('packs')
          .select('id, client_id, name, hours_total, price, invoice_number, purchase_date, status, notes')
          .eq('id', editingId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return {
    clients: clients ?? [],
    packs: packs ?? [],
    packSummaries: packSummaries ?? [],
    editingPack,
  }
})

export const getAdminActivitiesPageData = cache(async () => {
  const supabase = await createSupabaseServerClient()

  const [{ data: clients }, { data: packs }, { data: activities }] = await Promise.all([
    supabase.from('clients').select('id, name, email, status').eq('status', 'active').order('name'),
    supabase
      .from('packs')
      .select('id, client_id, name, status')
      .eq('status', 'active')
      .order('purchase_date', { ascending: false }),
    supabase
      .from('activities')
      .select('id, title, activity_type, hours_used, work_date, notify_client, clients(name), packs(name)')
      .order('work_date', { ascending: false })
      .limit(12),
  ])

  return {
    clients: clients ?? [],
    packs: packs ?? [],
    activities: activities ?? [],
  }
})
