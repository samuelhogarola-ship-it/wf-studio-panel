'use server'

import { redirect } from 'next/navigation'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getRequiredServerEnv } from '@/lib/env'

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

export async function clientMagicLinkAction(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim()
  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${getRequiredServerEnv('NEXT_PUBLIC_APP_URL')}/auth/callback?next=/cliente/dashboard`,
    },
  })

  if (error) {
    return { error: 'No se pudo enviar el magic link. Comprueba el email e inténtalo de nuevo.' }
  }

  return { success: 'Te hemos enviado un enlace de acceso a tu email.' }
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/paneladmin')
}
