import { NextResponse } from 'next/server'

import { sendPendingItemReminderEmail } from '@/lib/email'
import { getRequiredServerEnv } from '@/lib/env'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function getCronSecret() {
  return process.env.PENDING_REMINDERS_CRON_SECRET || process.env.CRON_SECRET
}

export async function POST(request: Request) {
  const configuredSecret = getCronSecret()
  const providedSecret = request.headers.get('x-cron-secret') || new URL(request.url).searchParams.get('secret')

  if (configuredSecret && providedSecret !== configuredSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: dueItems, error } = await supabase
    .from('pending_items')
    .select('id, client_id, title, description, requested_at, reminder_interval_days, next_reminder_at, clients(name, email)')
    .eq('status', 'pending')
    .not('reminder_interval_days', 'is', null)
    .not('next_reminder_at', 'is', null)
    .lte('next_reminder_at', today)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let sent = 0

  for (const item of dueItems ?? []) {
    const client = Array.isArray(item.clients) ? item.clients[0] : item.clients
    if (!client?.email || !item.reminder_interval_days) continue

    try {
      await sendPendingItemReminderEmail({
        clientEmail: client.email,
        clientName: client.name ?? 'cliente',
        title: item.title,
        description: item.description,
        requestedAt: item.requested_at,
      })

      const nextReminderAt = new Date(Date.now() + item.reminder_interval_days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

      await supabase
        .from('pending_items')
        .update({
          last_reminder_sent_at: new Date().toISOString(),
          next_reminder_at: nextReminderAt,
        })
        .eq('id', item.id)

      sent += 1
    } catch {
      // Fallo silencioso para que el cron continúe con el resto.
    }
  }

  return NextResponse.json({ ok: true, processed: dueItems?.length ?? 0, sent, appUrl: getRequiredServerEnv('NEXT_PUBLIC_APP_URL') })
}
