import type { ReactNode } from 'react'

import { requireClientAccess } from '@/lib/auth'
import { getLocale } from '@/lib/locale'
import { ClientShell } from '@/components/layout/client-shell'

export default async function ClientProtectedLayout({ children }: { children: ReactNode }) {
  const [identity, locale] = await Promise.all([requireClientAccess(), getLocale()])
  return (
    <ClientShell clientName={identity.client.name} clientEmail={identity.email} locale={locale}>
      {children}
    </ClientShell>
  )
}
