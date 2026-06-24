'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireClientAccess } from '@/lib/auth'
import { sendAdminRequestEmail } from '@/lib/email'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type MessageFormState = { error?: string; success?: string }

const sendSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  reply_to_id: z.string().uuid().optional(),
})

const requestSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  type: z.enum(['solicitud_servicio', 'solicitud_bono']),
})

export async function sendMessageAction(_prev: MessageFormState, formData: FormData): Promise<MessageFormState> {
  const identity = await requireClientAccess()
  const parsed = sendSchema.safeParse({
    subject: formData.get('subject'),
    body: formData.get('body'),
    reply_to_id: formData.get('reply_to_id') || undefined,
  })

  if (!parsed.success) return { error: 'Revisa el asunto y el mensaje.' }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('messages').insert({
    client_id: identity.client.id,
    direction: 'outbound',
    type: 'message',
    subject: parsed.data.subject,
    body: parsed.data.body,
    reply_to_id: parsed.data.reply_to_id ?? null,
  })

  if (error) return { error: 'No se pudo enviar el mensaje.' }

  revalidatePath('/cliente/mensajeria')
  return { success: 'Mensaje enviado.' }
}

export async function sendRequestAction(_prev: MessageFormState, formData: FormData): Promise<MessageFormState> {
  const identity = await requireClientAccess()
  const parsed = requestSchema.safeParse({
    subject: formData.get('subject'),
    body: formData.get('body'),
    type: formData.get('type'),
  })

  if (!parsed.success) return { error: 'Rellena todos los campos.' }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('messages').insert({
    client_id: identity.client.id,
    direction: 'outbound',
    type: parsed.data.type,
    subject: parsed.data.subject,
    body: parsed.data.body,
  })

  if (error) return { error: 'No se pudo enviar la solicitud.' }

  await sendAdminRequestEmail({
    clientName: identity.client.name,
    clientEmail: identity.email,
    subject: parsed.data.subject,
    body: parsed.data.body,
  }).catch(() => null)

  revalidatePath('/cliente/servicios')
  revalidatePath('/cliente/bonos')
  return { success: '¡Solicitud enviada! Te contactaremos pronto.' }
}

export async function markMessageReadAction(messageId: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', messageId).is('read_at', null)
  revalidatePath('/cliente/mensajeria')
}
