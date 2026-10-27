import type { ReactNode } from 'react'

import { getClientPortalContext } from '@/lib/data/projects'
import { getLocale } from '@/lib/locale'
import { buildPortalNavigation } from '@/lib/projects/portal-navigation.mjs'
import { ClientShell } from '@/components/layout/client-shell'

export default async function ClientProtectedLayout({ children }: { children: ReactNode }) {
  const context = await getClientPortalContext()
  const isSportMassage = context.projects.some(project =>
    project.slug === 'sportmassagefuengirola' || project.domain === 'sportmassagefuengirola.com')
  const locale = await getLocale(isSportMassage ? 'en' : 'es')
  const navigation = buildPortalNavigation({ mode: context.mode, projects: context.projects, locale })
  return (
    <ClientShell
      clientName={context.client.name}
      clientEmail={context.client.email}
      locale={locale}
      navigation={navigation}
      supportPreview={context.viewerMode === 'support' && context.supportExpiresAt && context.returnPath
        ? { expiresAt: context.supportExpiresAt, returnPath: context.returnPath }
        : undefined}
    >
      {children}
    </ClientShell>
  )
}
