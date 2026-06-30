'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth'
import { createSuperEntrenadorAdminClient } from '@/lib/supabase/server'

export async function approveTrainer(id: string) {
  await requireAdmin()
  const db = createSuperEntrenadorAdminClient()
  const { error } = await db
    .from('trainer_profiles')
    .update({ review_status: 'approved', is_published: true })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/paneladmin/superentrenador/pt')
}

export async function rejectTrainer(id: string) {
  await requireAdmin()
  const db = createSuperEntrenadorAdminClient()
  const { error } = await db
    .from('trainer_profiles')
    .update({ review_status: 'rejected', is_published: false })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/paneladmin/superentrenador/pt')
}
