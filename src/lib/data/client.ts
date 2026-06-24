import { cache } from 'react'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export const getClientServicesData = cache(async (clientId: string) => {
  const supabase = await createSupabaseServerClient()

  const [{ data: packs }, { data: activities }, { data: summaries }] = await Promise.all([
    supabase
      .from('packs')
      .select('id, name, pack_type, status, purchase_date, price, notes, minutes_total, renewal_date')
      .eq('client_id', clientId)
      .order('purchase_date', { ascending: false }),
    supabase
      .from('activities')
      .select('id, title, activity_type, minutes_used, work_date, pack_id')
      .eq('client_id', clientId)
      .order('work_date', { ascending: false }),
    supabase
      .from('pack_summary')
      .select('pack_id, used_minutes, remaining_minutes, minutes_total'),
  ])

  const actsByPack = new Map<string, typeof activities>()
  for (const a of activities ?? []) {
    if (!actsByPack.has(a.pack_id)) actsByPack.set(a.pack_id, [])
    actsByPack.get(a.pack_id)!.push(a)
  }

  const summaryMap = new Map((summaries ?? []).map((s) => [s.pack_id, s]))

  return {
    packs: (packs ?? []).map((p) => ({
      ...p,
      recentActivities: (actsByPack.get(p.id) ?? []).slice(0, 4),
      summary: summaryMap.get(p.id) ?? null,
    })),
  }
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

export const getClientMessages = async (clientId: string) => {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('messages')
    .select('id, subject, body, direction, type, read_at, reply_to_id, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  return data ?? []
}
