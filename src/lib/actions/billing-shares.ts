'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireAdmin } from '@/lib/auth'
import { createBillingShareToken } from '@/lib/billing/share-token'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type BillingShareActionState = { error?: string; success?: string; shareUrl?: string; shareId?: string }

export async function createBillingShareAction(_previous: BillingShareActionState, formData: FormData): Promise<BillingShareActionState> {
  await requireAdmin()
  const documentId = z.string().uuid().safeParse(String(formData.get('document_id') ?? ''))
  if (!documentId.success) return { error: 'Documento no válido.' }
  const { rawToken, tokenHash } = createBillingShareToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const db = await createSupabaseServerClient()
  const { data, error } = await db.rpc('create_billing_share', {
    p_document_id: documentId.data,
    p_token_hash: tokenHash,
    p_expires_at: expiresAt,
  })
  const saved = Array.isArray(data) ? data[0] : data
  if (error || !saved?.id) return { error: 'No se pudo crear el enlace privado.' }
  revalidatePath(`/paneladmin/contabilidad/documentos/${documentId.data}`)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  return { success: 'Enlace privado creado durante 7 días.', shareUrl: `${baseUrl ?? ''}/d/${rawToken}`, shareId: saved.id }
}

export async function revokeBillingShareAction(formData: FormData) {
  await requireAdmin()
  const shareId = z.string().uuid().safeParse(String(formData.get('share_id') ?? ''))
  if (!shareId.success) return
  const db = await createSupabaseServerClient()
  await db.rpc('revoke_billing_share', { p_share_id: shareId.data })
  revalidatePath('/paneladmin/contabilidad')
}
