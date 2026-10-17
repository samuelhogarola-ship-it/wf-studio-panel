import type { ReactNode } from 'react'

import { getClientPortalContext } from '@/lib/data/projects'
import { getLocale } from '@/lib/locale'
import { buildPortalNavigation } from '@/lib/projects/portal-navigation.mjs'
import { ClientShell } from '@/components/layout/client-shell'

export default async function ClientProtectedLayout({ children }: { children: ReactNode }) {
  const [context, locale] = await Promise.all([getClientPortalContext(), getLocale()])
  const navigation = buildPortalNavigation({ mode: context.mode, projects: context.projects, locale })
  return (
    <ClientShell clientName={context.client.name} clientEmail={context.email} locale={locale} navigation={navigation}>
      {children}
    </ClientShell>
  )
}
