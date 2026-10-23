import 'server-only'

import { requirePortalViewer } from '@/lib/support/portal-viewer'
import type { CapabilityKey } from '@/lib/supabase/types'

/** Account routes are universal; RLS keeps every read scoped to the active client. */
export async function requireClientCapability(...keys: CapabilityKey[]) {
  void keys
  return requirePortalViewer()
}

export async function requireLegacyClientPortal() {
  return requirePortalViewer()
}
