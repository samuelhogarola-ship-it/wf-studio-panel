'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireAdmin } from '@/lib/auth'
import { ACTIVITY_TYPES } from '@/lib/activity-types'
import { sendActivityNotificationEmail, sendPackDepletedEmail, sendPendingItemCreatedEmail } from '@/lib/email'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type AdminFormState = {
  error?: string
  success?: string
}

const PROJECT_VALUES = ['wf-studio', 'vivir-fuengirola', 'conoce-fuengirola'] as const
const PACK_TYPE_VALUES = ['hours', 'tasks', 'domain', 'hosting', 'service', 'subscription', 'membership'] as const
const BILLING_CYCLE_VALUES = ['one_time', 'monthly'] as const

const clientSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  name: z.string().min(2, 'El nombre es obligatorio.'),
  company: z.string().optional(),
  email: z.string().email('Introduce un email válido.'),
  phone: z.string().optional(),
  status: z.enum(['active', 'inactive']),
  project: z.enum(PROJECT_VALUES).default('wf-studio'),
})

const packSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  client_id: z.string().uuid('Selecciona un cliente.'),
  name: z.string().min(2, 'El nombre del pack es obligatorio.'),
  pack_type: z.enum(PACK_TYPE_VALUES),
  hours_total: z.coerce.number().nonnegative().optional(),
  price: z.union([z.coerce.number(), z.nan()]).optional(),
  invoice_number: z.string().optional(),
  purchase_date: z.string().min(1, 'La fecha es obligatoria.'),
  renewal_date: z.string().optional(),
  billing_cycle: z.enum(BILLING_CYCLE_VALUES).default('one_time'),
  paid: z.enum(['true', 'false']).default('false'),
  status: z.enum(['active', 'inactive', 'completed']),
  notes: z.string().optional(),
})

const activitySchema = z.object({
  client_id: z.string().uuid('Selecciona un cliente.'),
  pack_id: z.string().uuid('Selecciona un pack.'),
  activity_type: z.enum(ACTIVITY_TYPES),
  title: z.string().min(2, 'El título es obligatorio.'),
  description: z.string().optional(),
  hours_used: z.coerce.number().nonnegative().optional(),
  minutes_direct: z.coerce.number().int().nonnegative().optional(),
  work_date: z.string().min(1, 'La fecha es obligatoria.'),
  notify_client: z.enum(['on']).optional(),
})

function toStateError(message: string): AdminFormState {
  return { error: message }
}

function getClientListPath(project: string) {
  if (project === 'vivir-fuengirola') return '/paneladmin/vivir-en-fuengirola/clientes'
  if (project === 'conoce-fuengirola') return '/paneladmin/conoce-fuengirola/clientes'
  return '/paneladmin/clientes'
}

function getProjectSubscriptionsPath(project: string) {
  if (project === 'vivir-fuengirola') return '/paneladmin/vivir-en-fuengirola/suscripciones'
  if (project === 'conoce-fuengirola') return '/paneladmin/conoce-fuengirola/suscripciones'
  return null
}

async function getClientProject(clientId: string) {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.from('clients').select('project').eq('id', clientId).maybeSingle()
  return data?.project ?? 'wf-studio'
}

function revalidateProjectClientViews(project: string) {
  revalidatePath(getClientListPath(project))
  const subscriptionsPath = getProjectSubscriptionsPath(project)
  if (subscriptionsPath) {
    revalidatePath(subscriptionsPath)
  }
}

export async function upsertClientAction(_prevState: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()
  const parsed = clientSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    company: formData.get('company'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    status: formData.get('status'),
    project: formData.get('project') || 'wf-studio',
  })

  if (!parsed.success) {
    return toStateError(parsed.error.issues[0]?.message ?? 'No se pudo guardar el cliente.')
  }

  const payload = parsed.data

  if (payload.id) {
    const { data: currentClient } = await supabase.from('clients').select('email').eq('id', payload.id).maybeSingle()

    const { error } = await supabase
      .from('clients')
      .update({
        name: payload.name,
        company: payload.company || null,
        email: payload.email.toLowerCase(),
        phone: payload.phone || null,
        status: payload.status,
        project: payload.project,
      })
      .eq('id', payload.id)

    if (error) {
      return toStateError('No se pudo actualizar el cliente.')
    }

    if (currentClient?.email && currentClient.email.toLowerCase() !== payload.email.toLowerCase()) {
      const admin = getSupabaseAdminClient()
      const { data: profile } = await supabase.from('profiles').select('id, email').ilike('email', currentClient.email).maybeSingle()

      if (profile?.id) {
        const { error: authError } = await admin.auth.admin.updateUserById(profile.id, {
          email: payload.email.toLowerCase(),
        })

        if (authError) {
          return toStateError('Cliente actualizado, pero no se pudo sincronizar el email de acceso en Auth.')
        }

        await supabase.from('profiles').update({ email: payload.email.toLowerCase() }).eq('id', profile.id)
      }
    }

    revalidateProjectClientViews(payload.project)
    revalidatePath('/paneladmin/dashboard')
    return { success: 'Cliente actualizado correctamente.' }
  }

  const { error } = await supabase.from('clients').insert({
    name: payload.name,
    company: payload.company || null,
    email: payload.email.toLowerCase(),
    phone: payload.phone || null,
    status: payload.status,
    project: payload.project,
  })

  if (error) {
    return toStateError(error.message.includes('lower') ? 'Ya existe un cliente con ese email.' : 'No se pudo crear el cliente.')
  }

  revalidateProjectClientViews(payload.project)
  revalidatePath('/paneladmin/dashboard')
  return { success: 'Cliente creado correctamente.' }
}

export async function approveClientAction(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const supabase = await createSupabaseServerClient()
  if (!id) return
  const project = await getClientProject(id)
  await supabase.from('clients').update({ status: 'active' }).eq('id', id)
  revalidateProjectClientViews(project)
}

export async function rejectClientAction(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const supabase = await createSupabaseServerClient()
  if (!id) return
  const project = await getClientProject(id)
  await supabase.from('clients').update({ status: 'inactive' }).eq('id', id)
  revalidateProjectClientViews(project)
}

export async function deactivateClientAction(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const supabase = await createSupabaseServerClient()

  if (!id) return

  const project = await getClientProject(id)
  await supabase.from('clients').update({ status: 'inactive' }).eq('id', id)
  revalidateProjectClientViews(project)
  revalidatePath('/paneladmin/dashboard')
}

export async function upsertPackAction(_prevState: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()
  const parsed = packSchema.safeParse({
    id: formData.get('id'),
    client_id: formData.get('client_id'),
    name: formData.get('name'),
    pack_type: formData.get('pack_type'),
    hours_total: formData.get('hours_total') || 0,
    price: formData.get('price') || Number.NaN,
    invoice_number: formData.get('invoice_number'),
    purchase_date: formData.get('purchase_date'),
    renewal_date: formData.get('renewal_date'),
    billing_cycle: formData.get('billing_cycle') || 'one_time',
    paid: formData.get('paid') || 'false',
    status: formData.get('status'),
    notes: formData.get('notes'),
  })

  if (!parsed.success) {
    return toStateError(parsed.error.issues[0]?.message ?? 'No se pudo guardar el pack.')
  }

  const payload = parsed.data
  const record = {
    client_id: payload.client_id,
    name: payload.name,
    pack_type: payload.pack_type,
    minutes_total: payload.pack_type === 'hours' ? Math.round((payload.hours_total ?? 0) * 60) : 0,
    renewal_date: payload.renewal_date || null,
    billing_cycle: payload.billing_cycle,
    paid: payload.paid === 'true',
    price: Number.isNaN(payload.price) ? null : payload.price,
    invoice_number: payload.invoice_number || null,
    purchase_date: payload.purchase_date,
    status: payload.status,
    notes: payload.notes || null,
  }

  const query = payload.id ? supabase.from('packs').update(record).eq('id', payload.id) : supabase.from('packs').insert(record)
  const { error } = await query

  if (error) {
    return toStateError('No se pudo guardar el pack.')
  }

  const project = await getClientProject(payload.client_id)
  revalidateProjectClientViews(project)
  revalidatePath('/paneladmin/bonos')
  revalidatePath('/paneladmin/dashboard')
  return { success: payload.id ? 'Pack actualizado correctamente.' : 'Pack creado correctamente.' }
}

export async function createActivityAction(_prevState: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()
  const parsed = activitySchema.safeParse({
    client_id: formData.get('client_id'),
    pack_id: formData.get('pack_id'),
    activity_type: formData.get('activity_type'),
    title: formData.get('title'),
    description: formData.get('description'),
    hours_used: formData.get('hours_used') || 0,
    minutes_direct: formData.get('minutes_direct') ?? undefined,
    work_date: formData.get('work_date'),
    notify_client: formData.get('notify_client') ?? undefined,
  })

  if (!parsed.success) {
    return toStateError(parsed.error.issues[0]?.message ?? 'No se pudo guardar la actividad.')
  }

  const payload = parsed.data
  const { data: pack } = await supabase
    .from('packs')
    .select('id, name, status, pack_type, client_id, clients(name, email)')
    .eq('id', payload.pack_id)
    .eq('client_id', payload.client_id)
    .maybeSingle()

  if (!pack || pack.status !== 'active') {
    return toStateError('No se puede registrar actividad sobre un pack inactivo o no válido.')
  }

  const minutesUsed = pack.pack_type === 'tasks'
    ? 0
    : payload.minutes_direct !== undefined
      ? payload.minutes_direct
      : Math.round((payload.hours_used ?? 0) * 60)

  const { data: createdActivity, error: activityError } = await supabase
    .from('activities')
    .insert({
      client_id: payload.client_id,
      pack_id: payload.pack_id,
      activity_type: payload.activity_type,
      title: payload.title,
      description: payload.description || null,
      minutes_used: minutesUsed,
      work_date: payload.work_date,
      notify_client: payload.notify_client === 'on',
    })
    .select('id')
    .single()

  if (activityError || !createdActivity) {
    return toStateError('No se pudo guardar la actividad.')
  }

  const { data: summary } = await supabase.from('client_summary').select('*').eq('client_id', payload.client_id).maybeSingle()

  await supabase.from('notifications').insert({
    client_id: payload.client_id,
    activity_id: createdActivity.id,
    title: `${payload.title}`,
    body: `${payload.activity_type.toUpperCase()} realizado`,
    minutes_delta: minutesUsed * -1,
    remaining_minutes: Number(summary?.remaining_minutes ?? 0),
  })

  let success = 'Actividad registrada correctamente.'

  if (payload.notify_client === 'on' && pack.clients?.email) {
    try {
      await sendActivityNotificationEmail({
        clientEmail: pack.clients.email,
        clientName: pack.clients.name ?? 'cliente',
        activityTitle: payload.title,
        minutesUsed: minutesUsed,
        remainingMinutes: Number(summary?.remaining_minutes ?? 0),
      })
      success = 'Actividad registrada y email enviado correctamente.'
    } catch {
      success = 'Actividad registrada, pero el email no se pudo enviar.'
    }
  }

  // Auto-envío de historial cuando el pack se agota
  if (pack.pack_type === 'hours' && pack.clients?.email) {
    const { data: packSummary } = await supabase
      .from('pack_summary')
      .select('remaining_minutes')
      .eq('pack_id', payload.pack_id)
      .maybeSingle()

    if (packSummary && Number(packSummary.remaining_minutes) <= 0) {
      const { data: packActivities } = await supabase
        .from('activities')
        .select('title, activity_type, minutes_used, work_date')
        .eq('pack_id', payload.pack_id)
        .order('work_date', { ascending: false })

      if (packActivities?.length) {
        try {
          await sendPackDepletedEmail({
            clientEmail: pack.clients.email,
            clientName: pack.clients.name ?? 'cliente',
            packName: pack.name,
            activities: packActivities,
          })
        } catch {
          // fallo silencioso — el email se enviará cuando DNS esté configurado
        }
      }
    }
  }

  revalidatePath('/paneladmin/actividades')
  revalidatePath('/paneladmin/dashboard')
  revalidatePath('/cliente/dashboard')
  revalidatePath('/paneladmin/bonos')
  revalidatePath(`/paneladmin/bonos/${payload.pack_id}`)
  return { success }
}

const createClientDirectSchema = z.object({
  name: z.string().min(2, 'El nombre es obligatorio.'),
  email: z.string().email('Email inválido.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
  project: z.enum(PROJECT_VALUES).default('wf-studio'),
})

export async function createClientDirectAction(_prevState: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()
  const adminClient = getSupabaseAdminClient()

  const parsed = createClientDirectSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    project: formData.get('project') || 'wf-studio',
  })

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }

  const { name, email, password, project } = parsed.data

  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) return { error: authError.message }

  const { error: clientError } = await supabase.from('clients').insert({
    id: authUser.user.id,
    name,
    email,
    status: 'active',
    project,
  })

  if (clientError) {
    await adminClient.auth.admin.deleteUser(authUser.user.id)
    return { error: 'No se pudo crear el cliente.' }
  }

  revalidateProjectClientViews(project)
  return { success: `Cliente ${name} creado correctamente. Ya puede acceder con su contraseña.` }
}

const serviceSchema = z.object({
  id: z.string().uuid().optional(),
  client_id: z.string().uuid('Selecciona un cliente.'),
  pack_id: z.string().uuid().optional(),
  name: z.string().min(2, 'El nombre es obligatorio.'),
  service_type: z.string().min(1),
  price: z.coerce.number().nonnegative().optional(),
  service_date: z.string().min(1, 'La fecha es obligatoria.'),
  status: z.enum(['active', 'completed', 'cancelled']),
  notes: z.string().optional(),
})

const pendingItemSchema = z.object({
  client_id: z.string().uuid('Cliente inválido.'),
  title: z.string().min(2, 'Añade el dato pendiente.').max(200, 'El texto es demasiado largo.'),
  description: z.string().max(2000, 'La nota es demasiado larga.').optional(),
  reminder_frequency: z.enum(['none', 'daily', 'custom']).default('none'),
  reminder_interval_days: z.coerce.number().int().optional(),
})

const adminClientMessageSchema = z.object({
  client_id: z.string().uuid('Cliente inválido.'),
  subject: z.string().min(1, 'Añade un asunto.').max(200, 'El asunto es demasiado largo.'),
  body: z.string().min(1, 'Escribe el mensaje.').max(5000, 'El mensaje es demasiado largo.'),
  reply_to_id: z.string().uuid().optional(),
})

export async function upsertServiceAction(_prevState: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()

  const parsed = serviceSchema.safeParse({
    id: formData.get('id') || undefined,
    client_id: formData.get('client_id'),
    pack_id: formData.get('pack_id') || undefined,
    name: formData.get('name'),
    service_type: formData.get('service_type'),
    price: formData.get('price') || undefined,
    service_date: formData.get('service_date'),
    status: formData.get('status'),
    notes: formData.get('notes') || undefined,
  })

  if (!parsed.success) {
    return toStateError(parsed.error.issues[0]?.message ?? 'No se pudo guardar el servicio.')
  }

  const { id, ...payload } = parsed.data

  if (id) {
    const { error } = await supabase.from('services').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return toStateError('No se pudo actualizar el servicio.')
  } else {
    const { error } = await supabase.from('services').insert(payload)
    if (error) return toStateError('No se pudo guardar el servicio.')
  }

  revalidatePath('/paneladmin/servicios')
  return { success: id ? 'Servicio actualizado.' : 'Servicio registrado correctamente.' }
}

export async function createPendingItemAction(_prevState: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()

  const parsed = pendingItemSchema.safeParse({
    client_id: formData.get('client_id'),
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    reminder_frequency: formData.get('reminder_frequency') || 'none',
    reminder_interval_days: formData.get('reminder_interval_days') || undefined,
  })

  if (!parsed.success) {
    return toStateError(parsed.error.issues[0]?.message ?? 'No se pudo crear el pendiente.')
  }

  const { client_id, title, description, reminder_frequency, reminder_interval_days } = parsed.data
  const reminderDays =
    reminder_frequency === 'daily'
      ? 1
      : reminder_frequency === 'custom'
        ? reminder_interval_days
        : null

  if (reminder_frequency === 'custom' && (!reminderDays || reminderDays < 1)) {
    return toStateError('Indica cada cuántos días quieres enviar el recordatorio.')
  }

  const { data: currentLast } = await supabase
    .from('pending_items')
    .select('sort_order')
    .eq('client_id', client_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: client } = await supabase
    .from('clients')
    .select('name, email')
    .eq('id', client_id)
    .maybeSingle()

  const today = new Date().toISOString().slice(0, 10)
  const nextReminderAt = reminderDays
    ? new Date(Date.now() + reminderDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : null

  const { error } = await supabase.from('pending_items').insert({
    client_id,
    title,
    description: description || null,
    reminder_interval_days: reminderDays,
    next_reminder_at: nextReminderAt,
    sort_order: Number(currentLast?.sort_order ?? -1) + 1,
  })

  if (error) {
    if (error.code === 'PGRST205' || error.message.includes('pending_items')) {
      return toStateError('No se pudo crear el pendiente porque falta aplicar la migración de tareas pendientes en Supabase.')
    }

    return toStateError(`No se pudo crear el pendiente: ${error.message}`)
  }

  if (client?.email) {
    await sendPendingItemCreatedEmail({
      clientEmail: client.email,
      clientName: client.name ?? 'cliente',
      title,
      description: description || null,
      reminderIntervalDays: reminderDays,
    }).catch(() => null)
  }

  revalidatePath(`/paneladmin/clientes/${client_id}`)
  revalidatePath('/cliente/pendientes')
  revalidatePath('/cliente/dashboard')
  return { success: reminderDays ? `Pendiente creado y recordatorio configurado desde ${today}.` : 'Pendiente creado correctamente.' }
}

export async function sendAdminClientMessageAction(_prevState: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()

  const parsed = adminClientMessageSchema.safeParse({
    client_id: formData.get('client_id'),
    subject: formData.get('subject'),
    body: formData.get('body'),
    reply_to_id: formData.get('reply_to_id') || undefined,
  })

  if (!parsed.success) {
    return toStateError(parsed.error.issues[0]?.message ?? 'No se pudo enviar el mensaje.')
  }

  const { client_id, subject, body, reply_to_id } = parsed.data
  const { error } = await supabase.from('messages').insert({
    client_id,
    direction: 'inbound',
    type: 'message',
    subject,
    body,
    reply_to_id: reply_to_id ?? null,
  })

  if (error) {
    return toStateError(`No se pudo enviar el mensaje: ${error.message}`)
  }

  revalidatePath(`/paneladmin/clientes/${client_id}`)
  revalidatePath('/cliente/mensajeria')
  revalidatePath('/cliente/dashboard')
  return { success: 'Mensaje enviado al portal del cliente.' }
}

export async function togglePendingItemStatusAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()
  const itemId = String(formData.get('item_id') ?? '')
  const clientId = String(formData.get('client_id') ?? '')
  const currentStatus = String(formData.get('status') ?? 'pending')

  if (!itemId || !clientId) return

  const nextStatus = currentStatus === 'pending' ? 'received' : 'pending'
  const { data: currentItem } = await supabase
    .from('pending_items')
    .select('reminder_interval_days')
    .eq('id', itemId)
    .maybeSingle()

  const nextReminderAt =
    nextStatus === 'pending' && currentItem?.reminder_interval_days
      ? new Date(Date.now() + currentItem.reminder_interval_days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : null

  await supabase.from('pending_items').update({
    status: nextStatus,
    received_at: nextStatus === 'received' ? new Date().toISOString().slice(0, 10) : null,
    next_reminder_at: nextReminderAt,
  }).eq('id', itemId)

  revalidatePath(`/paneladmin/clientes/${clientId}`)
  revalidatePath('/cliente/pendientes')
  revalidatePath('/cliente/dashboard')
}

export async function deletePendingItemAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()
  const itemId = String(formData.get('item_id') ?? '')
  const clientId = String(formData.get('client_id') ?? '')

  if (!itemId || !clientId) return

  await supabase.from('pending_items').delete().eq('id', itemId)

  revalidatePath(`/paneladmin/clientes/${clientId}`)
  revalidatePath('/cliente/pendientes')
  revalidatePath('/cliente/dashboard')
}

export async function togglePackPaidAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()
  const packId = String(formData.get('pack_id'))
  const currentPaid = formData.get('paid') === 'true'
  const clientId = String(formData.get('client_id'))
  await supabase.from('packs').update({ paid: !currentPaid }).eq('id', packId)
  revalidatePath(`/paneladmin/clientes/${clientId}`)
}

export async function togglePackStatusAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()
  const packId = String(formData.get('pack_id'))
  const currentStatus = String(formData.get('status'))
  const clientId = String(formData.get('client_id'))
  const newStatus = currentStatus === 'active' ? 'completed' : 'active'
  await supabase.from('packs').update({ status: newStatus }).eq('id', packId)
  revalidatePath(`/paneladmin/clientes/${clientId}`)
}
