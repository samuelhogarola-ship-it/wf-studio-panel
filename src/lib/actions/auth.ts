'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export type AuthFormState = {
  error?: string
  success?: string
}

export async function adminLoginAction(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: 'No se pudo iniciar sesión. Revisa el email y la contraseña.' }
  }

  redirect('/paneladmin/dashboard')
}

export async function clientPasswordLoginAction(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Email o contraseña incorrectos.' }
  }

  redirect('/cliente/dashboard')
}

export async function clientMagicLinkAction(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim()
  const supabase = await createSupabaseServerClient()
  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? 'localhost:3000'
  const proto = headersList.get('x-forwarded-proto') ?? 'https'
  const baseUrl = `${proto}://${host}`

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${baseUrl}/auth/callback?next=/cliente/dashboard`,
    },
  })

  if (error) {
    return { error: 'No se pudo enviar el magic link. Comprueba el email e inténtalo de nuevo.' }
  }

  return { success: 'Te hemos enviado un enlace de acceso a tu email.' }
}

export async function clientRegisterAction(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!name || !email || !password) {
    return { error: 'Rellena todos los campos.' }
  }
  if (password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres.' }
  }

  const supabase = await createSupabaseServerClient()

  const { error: signUpError } = await supabase.auth.signUp({ email, password })
  if (signUpError) {
    if (signUpError.message.includes('already registered')) {
      return { error: 'Ya existe una cuenta con ese email.' }
    }
    return { error: 'No se pudo crear la cuenta. Inténtalo de nuevo.' }
  }

  const { error: clientError } = await supabase.from('clients').insert({
    name,
    email: email.toLowerCase(),
    status: 'pending',
  })

  if (clientError) {
    if (clientError.message.includes('lower')) {
      return { error: 'Ya existe un cliente con ese email.' }
    }
    return { error: 'No se pudo completar el registro.' }
  }

  return { success: 'Solicitud enviada. El equipo revisará tu acceso y te avisaremos.' }
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/paneladmin')
}
