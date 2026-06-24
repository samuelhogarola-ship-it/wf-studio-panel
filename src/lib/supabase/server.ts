import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

import { getPublicEnv } from '@/lib/env'
import type { Database } from '@/lib/supabase/types'

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SECRET_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase admin environment variables')
  return createClient<Database>(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  const env = getPublicEnv()

  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new Error('Missing Supabase public environment variables')
  }

  return createServerClient<Database>(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server Component context — middleware handles the refresh
        }
      },
    },
  })
}
