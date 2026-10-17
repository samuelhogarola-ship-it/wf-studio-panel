import 'server-only'

import { redirect } from 'next/navigation'
import { requireClientAccess } from '@/lib/auth'
import { clientHasActiveCapability } from '@/lib/data/projects'
import type { CapabilityKey } from '@/lib/supabase/types'

/** Account records stay client-owned; entitlement is checked before any page read. */
export async function requireClientCapability(...keys: CapabilityKey[]) {
  const identity = await requireClientAccess()
  if (identity.client.portal_mode === 'legacy') return identity
  const active = await Promise.all(keys.map(key => clientHasActiveCapability(key)))
  if (!active.some(Boolean)) redirect('/cliente/proyectos')
  return identity
}

export async function requireLegacyClientPortal() {
  const identity = await requireClientAccess()
  if (identity.client.portal_mode !== 'legacy') redirect('/cliente/proyectos')
  return identity
}
