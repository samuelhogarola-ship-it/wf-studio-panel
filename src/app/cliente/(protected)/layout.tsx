import type { ReactNode } from 'react'

import { requireClientAccess } from '@/lib/auth'

export default async function ClientProtectedLayout({ children }: { children: ReactNode }) {
  await requireClientAccess()
  return children
}
