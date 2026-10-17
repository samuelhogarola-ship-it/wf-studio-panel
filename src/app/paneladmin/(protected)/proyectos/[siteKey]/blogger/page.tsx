import { notFound } from 'next/navigation'

import { BloggerEditor } from '@/components/admin/blogger-editor'
import { AdminShell } from '@/components/layout/app-shell'
import { requireAdmin } from '@/lib/auth'
import { getLocale } from '@/lib/locale'
import { getSiteByKey } from '@/lib/sites/registry.mjs'

export default async function Page({ params }: { params: Promise<{ siteKey: string }> }) {
  const identity = await requireAdmin()
  const { siteKey } = await params
  const site = getSiteByKey(siteKey)
  if (!site.blogger.enabled) notFound()
  return <AdminShell title={`Blogger · ${site.name}`} description="Publicación estática" currentPath="/paneladmin/proyectos" userEmail={identity.email} locale={await getLocale()}><BloggerEditor /></AdminShell>
}
