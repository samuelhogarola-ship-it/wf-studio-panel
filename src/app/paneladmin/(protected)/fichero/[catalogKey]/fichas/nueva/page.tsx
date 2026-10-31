import { notFound } from 'next/navigation'

import { FicheroNav } from '@/components/fichero/fichero-nav'
import { ProfileEditor } from '@/components/fichero/profile-editor'
import { AdminShell } from '@/components/layout/app-shell'
import { requireAdmin } from '@/lib/auth'
import { getDirectoryCatalog } from '@/lib/fichero/admin'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ catalogKey: string }> }) {
  const { catalogKey } = await params
  const [identity, locale, catalog] = await Promise.all([requireAdmin(), getLocale(), getDirectoryCatalog(catalogKey)])
  if (!catalog) notFound()
  const path = `/paneladmin/fichero/${catalogKey}/fichas/nueva`
  return <AdminShell title="Nueva ficha" description={`Alta manual en ${catalog.name}`} currentPath={path} userEmail={identity.email} locale={locale}><FicheroNav catalogKey={catalogKey} currentPath={`/paneladmin/fichero/${catalogKey}/fichas`} /><ProfileEditor catalogKey={catalogKey} channels={[]} /></AdminShell>
}
