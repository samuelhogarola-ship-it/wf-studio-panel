import { redirect } from 'next/navigation'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export type AuthIdentity = {
  userId: string
  email: string
  role: string
}

export type ClientIdentity = AuthIdentity & {
  role: 'client'
  client: {
    id: string
    email: string
    status: string
    name: string
    portal_mode: 'legacy' | 'dynamic'
  }
}

const CLIENT_PROJECT = 'wf-studio'

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
    redirect('/paneladmin')
  }

  return identity
}

export async function requireClientAccess() {
  const identity = await getProfileIdentity()

  if (!identity) {
    console.warn('[auth/client] missing identity')
    redirect('/cliente')
  }

  if (identity.role !== 'client') {
    console.warn('[auth/client] non-client role blocked', {
      userId: identity.userId,
      role: identity.role,
    })
    redirect('/paneladmin/inicio')
  }

  const normalizedEmail = identity.email.trim().toLowerCase()
  const supabase = await createSupabaseServerClient()
  const { data: client } = await supabase
    .from('clients')
    .select('id, email, status, name, portal_mode')
    .eq('project', CLIENT_PROJECT)
    .ilike('email', normalizedEmail)
    .maybeSingle()

  if (!client || client.status !== 'active') {
    console.warn('[auth/client] access denied', {
      email: normalizedEmail,
      project: CLIENT_PROJECT,
      foundClient: Boolean(client),
      status: client?.status ?? null,
    })
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
