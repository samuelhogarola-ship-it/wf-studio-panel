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
        .select('id, title, minutes_used, work_date, client_id, clients(id, name), packs(name)')
        .order('work_date', { ascending: false })
        .limit(6),
    ])

  const pendingMinutes =
    summaries?.reduce((sum, item) => {
      return sum + Number(item.remaining_minutes ?? 0)
    }, 0) ?? 0

  return {
    activeClients: activeClients ?? 0,
    pendingMinutes,
    activePacks: activePacks ?? 0,
    monthActivities: monthActivities ?? 0,
    recentActivities: recentActivities ?? [],
  }
})

export const getAdminClientsPageData = cache(async (search: string, editingId?: string, category?: string) => {
  const supabase = await createSupabaseServerClient()
  const query = normalizeSearch(search)

  const pendingQuery = supabase
    .from('clients')
    .select('id, name, email, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const [{ data: allClients }, { data: editingClient }, { data: summaries }, { data: pendingClients }, { data: packs }, { data: services }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, company, email, phone, status, created_at, updated_at')
      .order('name'),
    editingId
      ? supabase.from('clients').select('id, name, company, email, phone, status').eq('id', editingId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('client_summary').select('*'),
    pendingQuery,
    supabase.from('packs').select('id, client_id, pack_type, status').eq('status', 'active'),
    supabase.from('services').select('id, client_id'),
  ])

  const packsByClient = new Map<string, string[]>()
  for (const p of packs ?? []) {
    const list = packsByClient.get(p.client_id) ?? []
    list.push(p.pack_type)
    packsByClient.set(p.client_id, list)
  }
  const clientsWithServices = new Set((services ?? []).map((s) => s.client_id))

  let clients = (allClients ?? []).filter((c) => c.status !== 'pending')

  if (query) {
    const q = query.toLowerCase()
    clients = clients.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.company ?? '').toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    )
  }

  if (category === 'horas') {
    clients = clients.filter((c) => (packsByClient.get(c.id) ?? []).includes('hours'))
  } else if (category === 'cerrado') {
    clients = clients.filter((c) => (packsByClient.get(c.id) ?? []).some((t) => t !== 'hours'))
  } else if (category === 'servicios') {
    clients = clients.filter((c) => clientsWithServices.has(c.id))
  }

  return {
    clients,
    editingClient,
    summaries: summaries ?? [],
    pendingClients: pendingClients ?? [],
    packsByClient,
    clientsWithServices,
  }
})

export const getAdminPacksPageData = cache(async (editingId?: string, typeFilter?: string) => {
  const supabase = await createSupabaseServerClient()

  let packsQuery = supabase
    .from('packs')
    .select('id, name, pack_type, client_id, minutes_total, price, invoice_number, purchase_date, renewal_date, status, notes, clients(name)')
    .order('purchase_date', { ascending: false })

  const validTypes = ['hours', 'tasks', 'domain', 'hosting', 'service']
  if (typeFilter && validTypes.includes(typeFilter)) {
    packsQuery = packsQuery.eq('pack_type', typeFilter)
  }

  const [{ data: clients }, { data: packs }, { data: packSummaries }, { data: editingPack }] = await Promise.all([
    supabase.from('clients').select('id, name, email, status').order('name'),
    packsQuery,
    supabase.from('pack_summary').select('*'),
    editingId
      ? supabase
          .from('packs')
          .select('id, client_id, name, pack_type, minutes_total, price, invoice_number, purchase_date, renewal_date, status, notes')
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

export const getClientDetailPageData = cache(async (clientId: string) => {
  const supabase = await createSupabaseServerClient()

  const [{ data: client }, { data: packs }, { data: packSummaries }, { data: recentActivities }] = await Promise.all([
    supabase.from('clients').select('id, name, company, email, phone, status, created_at').eq('id', clientId).maybeSingle(),
    supabase
      .from('packs')
      .select('id, name, pack_type, minutes_total, price, purchase_date, renewal_date, status, notes')
      .eq('client_id', clientId)
      .order('purchase_date', { ascending: false }),
    supabase.from('pack_summary').select('*').eq('client_id', clientId),
    supabase
      .from('activities')
      .select('id, title, activity_type, minutes_used, work_date, packs(name)')
      .eq('client_id', clientId)
      .order('work_date', { ascending: false })
      .limit(10),
  ])

  return {
    client,
    packs: packs ?? [],
    packSummaries: packSummaries ?? [],
    recentActivities: recentActivities ?? [],
  }
})

export const getAdminActivitiesPageData = cache(async () => {
  const supabase = await createSupabaseServerClient()

  const [{ data: clients }, { data: packs }, { data: activities }] = await Promise.all([
    supabase.from('clients').select('id, name, email, status').eq('status', 'active').order('name'),
    supabase
      .from('packs')
      .select('id, client_id, name, pack_type, status')
      .eq('status', 'active')
      .in('pack_type', ['hours', 'tasks'])
      .order('purchase_date', { ascending: false }),
    supabase
      .from('activities')
      .select('id, title, activity_type, minutes_used, work_date, notify_client, clients(name), packs(name)')
      .order('work_date', { ascending: false })
      .limit(12),
  ])

  return {
    clients: clients ?? [],
    packs: packs ?? [],
    activities: activities ?? [],
  }
})

export const getAdminServicesPageData = cache(async () => {
  const supabase = await createSupabaseServerClient()

  const [{ data: clients }, { data: services }] = await Promise.all([
    supabase.from('clients').select('id, name, email, status').order('name'),
    supabase
      .from('services')
      .select('id, name, service_type, price, service_date, status, notes, client_id, pack_id, clients(name), packs(name)')
      .order('service_date', { ascending: false }),
  ])

  return {
    clients: clients ?? [],
    services: services ?? [],
  }
})

export const getPackDetailData = cache(async (packId: string) => {
  const supabase = await createSupabaseServerClient()

  const [{ data: pack }, { data: activities }, { data: summary }] = await Promise.all([
    supabase
      .from('packs')
      .select('id, name, pack_type, client_id, minutes_total, price, purchase_date, renewal_date, status, notes, clients(id, name, email)')
      .eq('id', packId)
      .maybeSingle(),
    supabase
      .from('activities')
      .select('id, title, description, activity_type, minutes_used, work_date, notify_client')
      .eq('pack_id', packId)
      .order('work_date', { ascending: false }),
    supabase.from('pack_summary').select('*').eq('pack_id', packId).maybeSingle(),
  ])

  return { pack, activities: activities ?? [], summary }
})
