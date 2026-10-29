import { PlatformRequestInbox } from '@/components/admin/platform-request-inbox'
import { PlatformSectionNav } from '@/components/admin/platform-section-nav'
import { AdminShell } from '@/components/layout/app-shell'
import { requireAdmin } from '@/lib/auth'
import { getLocale } from '@/lib/locale'
import { getPendingPlatformRequestCounts, getPlatformRequestInbox } from '@/lib/platform-requests/admin'
import type { PlatformRequestStatus } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

const STATUSES = new Set<PlatformRequestStatus>(['pending', 'approved', 'rejected'])

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; request?: string }> }) {
  const params = await searchParams
  const status = STATUSES.has(params.status as PlatformRequestStatus) ? params.status as PlatformRequestStatus : params.status === 'all' ? undefined : 'pending'
  const [identity, locale, counts, data] = await Promise.all([
    requireAdmin(), getLocale(), getPendingPlatformRequestCounts(),
    getPlatformRequestInbox({ platforms: ['conoce-fuengirola'], status, query: params.q, selectedId: params.request }),
  ])
  return <AdminShell title="Solicitudes — Conoce Fuengirola" description="Altas recibidas desde la web pública" currentPath="/paneladmin/conoce-fuengirola/solicitudes" userEmail={identity.email} locale={locale}><PlatformSectionNav section="conoce" currentPath="/paneladmin/conoce-fuengirola/solicitudes" counts={counts} /><PlatformRequestInbox scope="conoce" data={data} query={params.q ?? ''} status={params.status === 'all' ? 'all' : status ?? 'pending'} /></AdminShell>
}
