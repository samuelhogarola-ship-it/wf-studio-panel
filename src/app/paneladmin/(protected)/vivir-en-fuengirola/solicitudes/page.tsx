import { PlatformRequestInbox } from '@/components/admin/platform-request-inbox'
import { PlatformSectionNav } from '@/components/admin/platform-section-nav'
import { AdminShell } from '@/components/layout/app-shell'
import { requireAdmin } from '@/lib/auth'
import { getPendingPlatformRequestCounts, getPlatformRequestInbox } from '@/lib/platform-requests/admin'
import { getLocale } from '@/lib/locale'
import type { PlatformRequestStatus } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

const STATUSES = new Set<PlatformRequestStatus>(['pending', 'approved', 'rejected'])

export default async function Page({ searchParams }: { searchParams: Promise<{ scope?: string; status?: string; q?: string; request?: string; page?: string }> }) {
  const params = await searchParams
  const businesses = params.scope === 'businesses'
  const status = STATUSES.has(params.status as PlatformRequestStatus) ? params.status as PlatformRequestStatus : params.status === 'all' ? undefined : 'pending'
  const [identity, locale, counts, data] = await Promise.all([
    requireAdmin(), getLocale(), getPendingPlatformRequestCounts(),
    getPlatformRequestInbox({ platforms: [businesses ? 'vivir-fuengirola-negocios' : 'vivir-fuengirola'], status, query: params.q, selectedId: params.request, page: Number(params.page) || 1 }),
  ])
  return <AdminShell title="Solicitudes — Vivir en Fuengirola" description="Altas recibidas desde la web pública" currentPath="/paneladmin/vivir-en-fuengirola/solicitudes" userEmail={identity.email} locale={locale}><PlatformSectionNav section="vivir" currentPath="/paneladmin/vivir-en-fuengirola/solicitudes" counts={counts} /><PlatformRequestInbox scope={businesses ? 'vivir-businesses' : 'vivir-clients'} data={data} query={params.q ?? ''} status={params.status === 'all' ? 'all' : status ?? 'pending'} /></AdminShell>
}
