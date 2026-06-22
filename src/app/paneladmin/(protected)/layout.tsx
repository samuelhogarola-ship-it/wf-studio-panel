import type { ReactNode } from 'react'

import { requireAdmin } from '@/lib/auth'

export default async function AdminProtectedLayout({ children }: { children: ReactNode }) {
  await requireAdmin()
  return children
}
