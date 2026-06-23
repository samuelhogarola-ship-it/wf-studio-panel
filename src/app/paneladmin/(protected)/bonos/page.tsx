import Link from 'next/link'

import { PackForm } from '@/components/admin/pack-form'
import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getAdminPacksPageData } from '@/lib/data/admin'
import { getLocale } from '@/lib/locale'
import { t } from '@/lib/i18n'
import { formatDate, formatDuration } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AdminPacksPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>
}) {
  const identity = await requireAdmin()
  const params = await searchParams
  const data = await getAdminPacksPageData(params.edit)
  const summaryMap = new Map(data.packSummaries.map((item) => [item.pack_id, item]))
  const locale = await getLocale()

  return (
    <AdminShell
      title={t(locale, 'packs.title')}
      description={t(locale, 'packs.description')}
      currentPath="/paneladmin/bonos"
      userEmail={identity.email}
      locale={locale}
    >
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <PackForm clients={data.clients} editingPack={data.editingPack} locale={locale} />

        <Card className="overflow-hidden">
          <div className="border-b border-line px-6 py-5">
            <h2 className="text-xl font-bold text-foreground">{t(locale, 'packs.list.title')}</h2>
            <p className="text-sm text-muted">{t(locale, 'packs.list.description')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-6 py-4">{t(locale, 'packs.list.col.pack')}</th>
                  <th className="px-6 py-4">{t(locale, 'packs.list.col.time')}</th>
                  <th className="px-6 py-4">{t(locale, 'packs.list.col.status')}</th>
                  <th className="px-6 py-4">{t(locale, 'packs.list.col.date')}</th>
                  <th className="px-6 py-4">{t(locale, 'packs.list.col.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.packs.map((pack) => {
                  const summary = summaryMap.get(pack.id)

                  return (
                    <tr key={pack.id}>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-foreground">{pack.name}</p>
                        <p className="text-slate-500">{pack.clients?.name ?? t(locale, 'packs.list.noName')}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-foreground">{formatDuration(summary?.minutes_total ?? pack.minutes_total)}</p>
                        <p className="text-slate-500">
                          {t(locale, 'packs.list.used')} {formatDuration(summary?.used_minutes ?? 0)} · {t(locale, 'packs.list.remaining')} {formatDuration(summary?.remaining_minutes ?? 0)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={pack.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}>{pack.status}</Badge>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{formatDate(pack.purchase_date)}</td>
                      <td className="px-6 py-4">
                        <Link href={`/paneladmin/bonos?edit=${pack.id}`} className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
                          {t(locale, 'packs.list.edit')}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {data.packs.length === 0 ? <p className="px-6 py-8 text-sm text-muted">{t(locale, 'packs.list.empty')}</p> : null}
          </div>
        </Card>
      </div>
    </AdminShell>
  )
}
