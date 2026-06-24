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
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const TYPE_TABS = [
  { key: '', label: 'Todos' },
  { key: 'hours', label: 'Horas' },
  { key: 'tasks', label: 'Tareas' },
  { key: 'domain', label: 'Dominios' },
  { key: 'hosting', label: 'Hosting' },
  { key: 'service', label: 'Servicios' },
]

const TYPE_LABELS: Record<string, string> = {
  hours: 'Horas',
  tasks: 'Tareas',
  domain: 'Dominio',
  hosting: 'Hosting',
  service: 'Servicio',
}

export default async function AdminPacksPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; type?: string }>
}) {
  const identity = await requireAdmin()
  const params = await searchParams
  const activeType = params.type ?? ''
  const data = await getAdminPacksPageData(params.edit, activeType)
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

          {/* Type filter tabs */}
          <div className="flex gap-1.5 overflow-x-auto border-b border-line px-4 py-3">
            {TYPE_TABS.map((tab) => (
              <Link
                key={tab.key}
                href={tab.key ? `/paneladmin/bonos?type=${tab.key}` : '/paneladmin/bonos'}
                className={cn(
                  'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition',
                  activeType === tab.key
                    ? 'bg-brand text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                {tab.label}
              </Link>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-6 py-4">{t(locale, 'packs.list.col.pack')}</th>
                  <th className="px-6 py-4">Tipo</th>
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
                    <tr key={pack.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-foreground">{pack.name}</p>
                        <p className="text-slate-500">{pack.clients?.name ?? t(locale, 'packs.list.noName')}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {TYPE_LABELS[pack.pack_type] ?? pack.pack_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {pack.pack_type === 'hours' || pack.pack_type === 'tasks' ? (
                          <>
                            <p className="font-medium text-foreground">{formatDuration(summary?.minutes_total ?? pack.minutes_total)}</p>
                            <p className="text-slate-500">
                              {t(locale, 'packs.list.used')} {formatDuration(summary?.used_minutes ?? 0)} · {t(locale, 'packs.list.remaining')} {formatDuration(summary?.remaining_minutes ?? 0)}
                            </p>
                          </>
                        ) : (
                          <p className="text-slate-400 text-xs">—</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={pack.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}>{pack.status}</Badge>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {pack.renewal_date ? formatDate(pack.renewal_date) : formatDate(pack.purchase_date)}
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/paneladmin/bonos?edit=${pack.id}${activeType ? `&type=${activeType}` : ''}`} className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
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
