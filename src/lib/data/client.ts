import { cache } from 'react'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export const getClientServicesData = cache(async (clientId: string) => {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('services')
    .select('id, name, service_type, status, service_date, price, notes')
    .eq('client_id', clientId)
    .order('service_date', { ascending: false })
  return data ?? []
})

export const getClientBonosData = cache(async (clientId: string) => {
  const supabase = await createSupabaseServerClient()
  const [{ data: packs }, { data: summaries }] = await Promise.all([
    supabase
      .from('packs')
      .select('id, name, minutes_total, status, purchase_date, renewal_date')
      .eq('client_id', clientId)
      .eq('pack_type', 'hours')
      .order('purchase_date', { ascending: false }),
    supabase.from('pack_summary').select('pack_id, used_minutes, remaining_minutes'),
  ])
  const summaryMap = new Map((summaries ?? []).map((s) => [s.pack_id, s]))
  return { packs: packs ?? [], summaryMap }
})

export const getClientMessages = async (clientId: string) => {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('messages')
    .select('id, subject, body, direction, type, read_at, reply_to_id, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export const getClientDashboardData = cache(async (clientId: string) => {
  const supabase = await createSupabaseServerClient()

  const [
    { data: hoursPacks },
    { data: closedPacks },
    { data: packSummaries },
    { data: activities },
    { data: notifications },
  ] = await Promise.all([
    supabase
      .from('packs')
      .select('id, name, minutes_total, status')
      .eq('pack_type', 'hours')
      .eq('status', 'active')
      .order('purchase_date', { ascending: false }),
    supabase
      .from('packs')
      .select('id, name, pack_type, renewal_date, notes, status')
      .neq('pack_type', 'hours')
      .eq('status', 'active')
      .order('purchase_date', { ascending: false }),
    supabase
      .from('pack_summary')
      .select('pack_id, minutes_total, used_minutes, remaining_minutes'),
    supabase
      .from('activities')
      .select('id, title, description, minutes_used, work_date, activity_type, packs(name)')
      .order('work_date', { ascending: false })
      .limit(20),
    supabase
      .from('notifications')
      .select('id, title, body, minutes_delta, remaining_minutes, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const summaryMap = new Map((packSummaries ?? []).map((s) => [s.pack_id, s]))

  return {
    hoursPacks: hoursPacks ?? [],
    closedPacks: closedPacks ?? [],
    summaryMap,
    activities: activities ?? [],
    notifications: notifications ?? [],
  }
})
