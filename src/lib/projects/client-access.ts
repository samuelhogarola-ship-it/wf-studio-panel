import 'server-only'

import { requireClientAccess } from '@/lib/auth'
import type { CapabilityKey } from '@/lib/supabase/types'

/** Account routes are universal; RLS keeps every read scoped to the active client. */
export async function requireClientCapability(...keys: CapabilityKey[]) {
  void keys
  return requireClientAccess()
}

export async function requireLegacyClientPortal() {
  return requireClientAccess()
}
