'use server'

import { redirect } from 'next/navigation'

import { getAppOrigin } from '@/lib/env'
import { registerPendingClient } from '@/lib/auth/register.mjs'
import { buildCanonicalAppUrl } from '@/lib/security/redirects.mjs'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
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

  const { data: client } = await supabase
    .from('clients')
    .select('id, status')
    .ilike('email', email)
    .maybeSingle()

  if (!client) {
    return { error: 'No tienes cuenta con nosotros. Contacta con el estudio para registrarte.' }
  }

  if (client.status !== 'active') {
    return { error: 'Tu cuenta no está activa. Contacta con el estudio.' }
  }

  let emailRedirectTo: string

  try {
    emailRedirectTo = buildCanonicalAppUrl(
      getAppOrigin(),
      '/auth/callback?next=%2Fcliente%2Fdashboard',
    ).toString()
  } catch {
    return { error: 'Falta la URL canónica de la app. Configura APP_URL o NEXT_PUBLIC_APP_URL.' }
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
      shouldCreateUser: false,
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
  const adminClient = getSupabaseAdminClient()

  return registerPendingClient({
    name,
    email,
    password,
    signUp: async ({ email: signUpEmail, password: signUpPassword }) => {
      const { data, error } = await supabase.auth.signUp({
        email: signUpEmail,
        password: signUpPassword,
      })

      return {
        userId: data.user?.id ?? null,
        error: error ? { message: error.message } : null,
      }
    },
    insertClient: async (client) => {
      const { error } = await supabase.from('clients').insert(client)
      return {
        error: error ? { message: error.message } : null,
      }
    },
    deleteUser: async (userId) => {
      await adminClient.auth.admin.deleteUser(userId)
    },
  })
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/paneladmin')
}
