'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth'
import { createImKontextAdminClient } from '@/lib/supabase/server'

export async function togglePublishAction(formData: FormData) {
  await requireAdmin()
  const textId = formData.get('textId') as string
  const current = formData.get('current') === 'true'
  const db = createImKontextAdminClient()
  await db.from('samuel_texts').update({ is_published: !current }).eq('id', textId)
  revalidatePath('/paneladmin/samuel-coach')
}
