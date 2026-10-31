import { notFound } from 'next/navigation'

import { PlatformRequestInbox } from '@/components/admin/platform-request-inbox'
import { FicheroNav } from '@/components/fichero/fichero-nav'
import { AdminShell } from '@/components/layout/app-shell'
import { requireAdmin } from '@/lib/auth'
import { getDirectoryCatalog } from '@/lib/fichero/admin'
import { getLocale } from '@/lib/locale'
import { getPlatformRequestInbox } from '@/lib/platform-requests/admin'
import type { PlatformRequestStatus } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
const statuses = new Set<PlatformRequestStatus>(['pending', 'approved', 'rejected'])

export default async function Page({ params, searchParams }: { params: Promise<{ catalogKey: string }>; searchParams: Promise<{ status?: string; q?: string; request?: string; page?: string }> }) {
  const [{ catalogKey }, query] = await Promise.all([params, searchParams])
  const status = statuses.has(query.status as PlatformRequestStatus) ? query.status as PlatformRequestStatus : query.status === 'all' ? undefined : 'pending'
  const [identity, locale, catalog, data] = await Promise.all([requireAdmin(), getLocale(), getDirectoryCatalog(catalogKey), getPlatformRequestInbox({ platforms: ['vivir-fuengirola-negocios', 'conoce-fuengirola'], status, query: query.q, selectedId: query.request, page: Number(query.page) || 1 })])
  if (!catalog) notFound()
  const path = `/paneladmin/fichero/${catalogKey}/solicitudes`
  return <AdminShell title={`Solicitudes · ${catalog.name}`} description="Altas recibidas desde todos los canales del directorio" currentPath={path} userEmail={identity.email} locale={locale}><FicheroNav catalogKey={catalogKey} currentPath={path} /><PlatformRequestInbox scope="fichero" data={data} query={query.q ?? ''} status={query.status === 'all' ? 'all' : status ?? 'pending'} /></AdminShell>
}
