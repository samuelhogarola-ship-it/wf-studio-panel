'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { registerPendingClient } from '@/lib/auth/register.mjs'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

async function getRequestOrigin(): Promise<string> {
  const h = await headers()

  const origin = h.get('origin')
  if (origin) return new URL(origin).origin

  const referer = h.get('referer')
  if (referer) return new URL(referer).origin

  const forwardedHost = h.get('x-forwarded-host')
  if (forwardedHost) {
    const proto = h.get('x-forwarded-proto') ?? 'https'
    return `${proto}://${forwardedHost}`
  }

  const host = h.get('host')
  if (host && !host.startsWith('localhost') && !host.startsWith('127.')) {
    return `https://${host}`
  }

  throw new Error('Could not determine request origin')
}

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
  const adminClient = getSupabaseAdminClient()

  const { data: client } = await adminClient
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
    const origin = await getRequestOrigin()
    emailRedirectTo = new URL('/auth/callback?next=%2Fcliente%2Fdashboard', origin).toString()
  } catch {
    return { error: 'No se pudo determinar la URL de la app.' }
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
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

export async function resetPasswordAction(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim()
  const supabase = await createSupabaseServerClient()
  const adminClient = getSupabaseAdminClient()

  const { data: client } = await adminClient
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

  let redirectTo: string

  try {
    const origin = await getRequestOrigin()
    redirectTo = new URL('/auth/callback?next=%2Fauth%2Factualizar-contrasena', origin).toString()
  } catch {
    return { error: 'No se pudo determinar la URL de la app.' }
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

  if (error) {
    return { error: 'No se pudo enviar el email. Inténtalo de nuevo.' }
  }

  return { success: 'Te hemos enviado un enlace para restablecer tu contraseña.' }
}

export async function updatePasswordAction(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')

  if (password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres.' }
  }

  if (password !== confirm) {
    return { error: 'Las contraseñas no coinciden.' }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: 'No se pudo actualizar la contraseña. El enlace puede haber expirado.' }
  }

  redirect('/cliente/dashboard')
}

export async function signOutAction(formData: FormData) {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  const destination = formData.get('redirect') === 'admin' ? '/paneladmin' : '/cliente'
  redirect(destination)
}
