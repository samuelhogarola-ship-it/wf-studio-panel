import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { getPublicEnv } from '@/lib/env'
import type { Database } from '@/lib/supabase/types'

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
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
      },
    },
  })
}
