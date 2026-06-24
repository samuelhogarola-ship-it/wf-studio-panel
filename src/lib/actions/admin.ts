'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireAdmin } from '@/lib/auth'
import { ACTIVITY_TYPES } from '@/lib/activity-types'
import { sendActivityNotificationEmail } from '@/lib/email'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type AdminFormState = {
  error?: string
  success?: string
}

const clientSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  name: z.string().min(2, 'El nombre es obligatorio.'),
  company: z.string().optional(),
  email: z.string().email('Introduce un email válido.'),
  phone: z.string().optional(),
  status: z.enum(['active', 'inactive']),
})

const packSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  client_id: z.string().uuid('Selecciona un cliente.'),
  name: z.string().min(2, 'El nombre del pack es obligatorio.'),
  pack_type: z.enum(['hours', 'tasks', 'domain', 'hosting', 'service']),
  hours_total: z.coerce.number().nonnegative().optional(),
  price: z.union([z.coerce.number(), z.nan()]).optional(),
  invoice_number: z.string().optional(),
  purchase_date: z.string().min(1, 'La fecha es obligatoria.'),
  renewal_date: z.string().optional(),
  status: z.enum(['active', 'inactive']),
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

    revalidatePath('/paneladmin/clientes')
    revalidatePath('/paneladmin/dashboard')
    return { success: 'Cliente actualizado correctamente.' }
  }

  const { error } = await supabase.from('clients').insert({
    name: payload.name,
    company: payload.company || null,
    email: payload.email.toLowerCase(),
    phone: payload.phone || null,
    status: payload.status,
  })

  if (error) {
    return toStateError(error.message.includes('lower') ? 'Ya existe un cliente con ese email.' : 'No se pudo crear el cliente.')
  }

  revalidatePath('/paneladmin/clientes')
  revalidatePath('/paneladmin/dashboard')
  return { success: 'Cliente creado correctamente.' }
}

export async function approveClientAction(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const supabase = await createSupabaseServerClient()
  if (!id) return
  await supabase.from('clients').update({ status: 'active' }).eq('id', id)
  revalidatePath('/paneladmin/clientes')
}

export async function rejectClientAction(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const supabase = await createSupabaseServerClient()
  if (!id) return
  await supabase.from('clients').update({ status: 'inactive' }).eq('id', id)
  revalidatePath('/paneladmin/clientes')
}

export async function deactivateClientAction(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const supabase = await createSupabaseServerClient()

  if (!id) return

  await supabase.from('clients').update({ status: 'inactive' }).eq('id', id)
  revalidatePath('/paneladmin/clientes')
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
})

export async function createClientDirectAction(_prevState: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()
  const adminClient = getSupabaseAdminClient()

  const parsed = createClientDirectSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }

  const { name, email, password } = parsed.data

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
  })

  if (clientError) {
    await adminClient.auth.admin.deleteUser(authUser.user.id)
    return { error: 'No se pudo crear el cliente.' }
  }

  revalidatePath('/paneladmin/clientes')
  return { success: `Cliente ${name} creado correctamente. Ya puede acceder con su contraseña.` }
}
