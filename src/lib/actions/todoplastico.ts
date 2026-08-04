'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth'
import { createTodoPlasticoAdminClient } from '@/lib/supabase/server'

export async function updateTodoPlasticoListingAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  const action = String(formData.get('action'))
  const status = action === 'approve' ? 'published' : action === 'reject' ? 'rejected' : null

  if (!Number.isInteger(id) || !status) return

  const db = createTodoPlasticoAdminClient()
  await db
    .from('mkt_listings')
    .update({
      status,
      rejection_reason: status === 'rejected' ? 'Revisado desde WF Studio.' : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending_review')

  revalidatePath('/paneladmin/todoplastico')
}

export async function updateTodoPlasticoCompanyAction(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const action = String(formData.get('action') ?? '')

  if (!id || !['verify', 'block', 'activate'].includes(action)) return

  const db = createTodoPlasticoAdminClient()
  if (action === 'verify') await db.from('mkt_companies').update({ is_verified: true }).eq('id', id)
  if (action === 'block') await db.from('mkt_companies').update({ status: 'blocked' }).eq('id', id)
  if (action === 'activate') await db.from('mkt_companies').update({ status: 'active' }).eq('id', id)

  revalidatePath('/paneladmin/todoplastico')
}
