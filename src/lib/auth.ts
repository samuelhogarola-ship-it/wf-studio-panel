import { redirect } from 'next/navigation'

import { createSupabaseServerClient } from '@/lib/supabase/server'

type AuthIdentity = {
  userId: string
  email: string
  role: 'admin' | 'client'
}

async function getProfileIdentity() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    return {
      userId: user.id,
      email: user.email,
      role: 'client' as const,
    }
  }

  return {
    userId: profile.id,
    email: profile.email ?? user.email,
    role: profile.role,
  }
}

export async function requireAdmin() {
  const identity = await getProfileIdentity()

  if (!identity) {
    redirect('/paneladmin')
  }

  if (identity.role !== 'admin') {
    redirect('/cliente/dashboard')
  }

  return identity
}

export async function requireClientAccess() {
  const identity = await getProfileIdentity()

  if (!identity) {
    redirect('/cliente')
  }

  if (identity.role !== 'client') {
    redirect('/paneladmin/dashboard')
  }

  const supabase = await createSupabaseServerClient()
  const { data: client } = await supabase
    .from('clients')
    .select('id, email, status, name')
    .ilike('email', identity.email)
    .maybeSingle()

  if (!client || client.status !== 'active') {
    redirect('/cliente?error=inactive')
  }

  return {
    ...identity,
    client,
  }
}

export async function getOptionalIdentity(): Promise<AuthIdentity | null> {
  return getProfileIdentity()
}
