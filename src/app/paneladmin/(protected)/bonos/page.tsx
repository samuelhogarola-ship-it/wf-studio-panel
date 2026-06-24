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
  searchParams: Promise<{ edit?: string; type?: string; new?: string }>
}) {
  const identity = await requireAdmin()
  const params = await searchParams
  const activeType = params.type ?? ''
  const showNew = params.new === '1' || !!params.edit
  const data = await getAdminPacksPageData(params.edit, activeType)
  const summaryMap = new Map(data.packSummaries.map((item) => [item.pack_id, item]))
  const locale = await getLocale()

  const typeParam = activeType ? `&type=${activeType}` : ''

  return (
    <AdminShell
      title={t(locale, 'packs.title')}
      description={t(locale, 'packs.description')}
      currentPath="/paneladmin/bonos"
      userEmail={identity.email}
      locale={locale}
    >
      {/* Form panel — visible when ?new=1 or ?edit=... */}
      {showNew && (
        <div className="mb-6 rounded-xl border border-line bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">
              {params.edit ? 'Editar bono' : 'Nuevo bono'}
            </h2>
            <Link
              href={`/paneladmin/bonos${activeType ? `?type=${activeType}` : ''}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition text-lg leading-none"
            >
              ×
            </Link>
          </div>
          <PackForm clients={data.clients} editingPack={data.editingPack} locale={locale} />
        </div>
      )}

      <Card className="overflow-hidden">
        {/* Header row: filter tabs + new button */}
        <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
          <div className="flex gap-1.5 overflow-x-auto">
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
          <Link
            href={`/paneladmin/bonos?new=1${typeParam}`}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition"
          >
            <span className="text-base leading-none">+</span> Nuevo bono
          </Link>
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
                      <Link
                        href={`/paneladmin/bonos?edit=${pack.id}${typeParam}`}
                        className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-200 transition"
                      >
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
    </AdminShell>
  )
}
