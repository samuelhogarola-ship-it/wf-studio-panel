import { cache } from 'react'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export const getClientDashboardData = cache(async (email: string) => {
  const supabase = await createSupabaseServerClient()

  const [{ data: summary }, { data: activities }, { data: notifications }] = await Promise.all([
    supabase.from('client_summary').select('*').ilike('client_email', email).maybeSingle(),
    supabase
      .from('activities')
      .select('id, title, description, minutes_used, work_date, activity_type')
      .order('work_date', { ascending: false }),
    supabase
      .from('notifications')
      .select('id, title, body, minutes_delta, remaining_minutes, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return {
    summary,
    activities: activities ?? [],
    notifications: notifications ?? [],
  }
})
