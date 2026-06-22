'use client'

import { createBrowserClient } from '@supabase/ssr'

import { getPublicEnv } from '@/lib/env'
import type { Database } from '@/lib/supabase/types'

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createSupabaseBrowserClient() {
  if (!browserClient) {
    const env = getPublicEnv()

    if (!env.supabaseUrl || !env.supabaseKey) {
      throw new Error('Missing Supabase public environment variables')
    }

    browserClient = createBrowserClient<Database>(env.supabaseUrl, env.supabaseKey)
  }

  return browserClient
}
