import { createClient } from '@supabase/supabase-js'

import { getPublicEnv, getRequiredServerEnv, getSupabaseAdminKey } from '@/lib/env'
import type { Database } from '@/lib/supabase/types'

let adminClient: ReturnType<typeof createClient<Database>> | null = null

export function getSupabaseAdminClient() {
  if (!adminClient) {
    const env = getPublicEnv()
    adminClient = createClient<Database>(
      env.supabaseUrl ?? getRequiredServerEnv('NEXT_PUBLIC_SUPABASE_URL'),
      getSupabaseAdminKey(),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    )
  }

  return adminClient
}
