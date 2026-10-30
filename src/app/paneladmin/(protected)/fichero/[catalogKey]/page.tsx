import Link from 'next/link'
import { notFound } from 'next/navigation'

import { FicheroNav } from '@/components/fichero/fichero-nav'
import { AdminShell } from '@/components/layout/app-shell'
import { requireAdmin } from '@/lib/auth'
import { getDirectoryCatalog, getDirectoryProfiles } from '@/lib/fichero/admin'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ catalogKey: string }> }) {
  const { catalogKey } = await params
  const [identity, locale, catalog, pending, failed] = await Promise.all([requireAdmin(), getLocale(), getDirectoryCatalog(catalogKey), getDirectoryProfiles({ catalogKey, reviewStatus: 'pending_review' }), getDirectoryProfiles({ catalogKey, publicationStatus: 'failed' })])
  if (!catalog) notFound()
  const base = `/paneladmin/fichero/${catalogKey}`
  return <AdminShell title={`Fichero · ${catalog.name}`} description="Estado del directorio canónico" currentPath={base} userEmail={identity.email} locale={locale}><FicheroNav catalogKey={catalogKey} currentPath={base} /><div className="grid gap-4 md:grid-cols-3"><Link href={`${base}/solicitudes`} className="rounded-2xl border border-line bg-white p-6"><p className="text-sm text-muted">Entrada</p><h2 className="mt-2 text-xl font-black">Solicitudes</h2></Link><Link href={`${base}/fichas?review=pending_review`} className="rounded-2xl border border-line bg-white p-6"><p className="text-sm text-muted">Pendientes de revisión</p><p className="mt-2 text-3xl font-black">{pending.total}</p></Link><Link href={`${base}/fichas?publication=failed`} className="rounded-2xl border border-line bg-white p-6"><p className="text-sm text-muted">Canales con fallo</p><p className="mt-2 text-3xl font-black">{failed.total}</p></Link></div></AdminShell>
}
