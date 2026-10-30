import Link from 'next/link'

import { AdminShell } from '@/components/layout/app-shell'
import { requireAdmin } from '@/lib/auth'
import { getDirectoryCatalogs } from '@/lib/fichero/admin'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [identity, locale, catalogs] = await Promise.all([requireAdmin(), getLocale(), getDirectoryCatalogs()])
  return <AdminShell title="Fichero" description="Revisión humana y publicación de directorios" currentPath="/paneladmin/fichero" userEmail={identity.email} locale={locale}><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{catalogs.map(catalog => <Link key={catalog.id} href={`/paneladmin/fichero/${catalog.key}`} className="rounded-2xl border border-line bg-white p-6 shadow-sm transition hover:border-brand"><p className="text-xs font-bold uppercase tracking-wider text-brand">Directorio</p><h2 className="mt-2 text-xl font-black capitalize">{catalog.name}</h2><p className="mt-2 text-sm text-muted">Solicitudes, fichas, revisión y publicaciones.</p></Link>)}</div></AdminShell>
}
