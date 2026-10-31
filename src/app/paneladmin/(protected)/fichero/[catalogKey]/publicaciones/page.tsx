import Link from 'next/link'
import { notFound } from 'next/navigation'

import { FicheroNav } from '@/components/fichero/fichero-nav'
import { AdminShell } from '@/components/layout/app-shell'
import { requireAdmin } from '@/lib/auth'
import { getDirectoryCatalog, getDirectoryPublicationFeed } from '@/lib/fichero/admin'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ catalogKey: string }> }) {
  const { catalogKey } = await params
  const [identity, locale, catalog, events] = await Promise.all([requireAdmin(), getLocale(), getDirectoryCatalog(catalogKey), getDirectoryPublicationFeed(catalogKey)])
  if (!catalog) notFound()
  const path = `/paneladmin/fichero/${catalogKey}/publicaciones`
  return <AdminShell title={`Publicaciones · ${catalog.name}`} description="Historial técnico por versión y canal" currentPath={path} userEmail={identity.email} locale={locale}><FicheroNav catalogKey={catalogKey} currentPath={path} /><div className="overflow-hidden rounded-2xl border border-line bg-white"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-4">Ficha</th><th className="p-4">Versión</th><th className="p-4">Estado</th><th className="p-4">Fecha</th></tr></thead><tbody>{events.map(event => <tr key={event.id} className="border-t border-line"><td className="p-4"><Link href={`/paneladmin/fichero/${catalogKey}/fichas/${event.profile_id}`} className="font-bold text-brand">{event.displayName}</Link></td><td className="p-4">{event.source_version}</td><td className="p-4">{event.status}</td><td className="p-4">{new Intl.DateTimeFormat('es-ES').format(new Date(event.created_at))}</td></tr>)}</tbody></table>{events.length === 0 ? <p className="p-8 text-sm text-muted">Aún no hay publicaciones.</p> : null}</div></AdminShell>
}
