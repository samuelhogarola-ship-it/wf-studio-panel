import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getClientDetailPageData } from '@/lib/data/admin'
import { getLocale } from '@/lib/locale'
import { t } from '@/lib/i18n'
import { formatDate, formatDuration } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const PACK_TYPE_ORDER = ['hours', 'tasks', 'domain', 'hosting', 'service'] as const
type PackType = (typeof PACK_TYPE_ORDER)[number]

const SECTION_KEY: Record<PackType, 'clientDetail.section.bonos' | 'clientDetail.section.tasks' | 'clientDetail.section.domains' | 'clientDetail.section.hosting' | 'clientDetail.section.services'> = {
  hours: 'clientDetail.section.bonos',
  tasks: 'clientDetail.section.tasks',
  domain: 'clientDetail.section.domains',
  hosting: 'clientDetail.section.hosting',
  service: 'clientDetail.section.services',
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await requireAdmin()
  const { id } = await params
  const data = await getClientDetailPageData(id)
  const locale = await getLocale()

  if (!data.client) notFound()

  const { client, packs, packSummaries, recentActivities } = data
  const summaryMap = new Map(packSummaries.map((s) => [s.pack_id, s]))

  const activePacks = packs.filter((p) => p.status === 'active')
  const inactivePacks = packs.filter((p) => p.status !== 'active')

  const grouped = PACK_TYPE_ORDER.reduce<Record<PackType, typeof activePacks>>((acc, type) => {
    acc[type] = activePacks.filter((p) => p.pack_type === type)
    return acc
  }, {} as Record<PackType, typeof activePacks>)

  return (
    <AdminShell
      title={client.name}
      description={client.email}
      currentPath="/paneladmin/clientes"
      userEmail={identity.email}
      locale={locale}
    >
      <div className="mb-6">
        <Link href="/paneladmin/clientes" className="text-sm font-semibold text-brand hover:underline">
          ← {t(locale, 'clientDetail.back')}
        </Link>
      </div>

      {/* Client info */}
      <Card className="mb-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">{client.name}</h2>
            {client.company && <p className="text-sm text-muted">{client.company}</p>}
            <p className="text-sm text-muted">{client.email}</p>
            {client.phone && <p className="text-sm text-muted">{client.phone}</p>}
          </div>
          <div className="flex flex-col items-end gap-1 text-sm text-muted">
            <Badge className={client.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}>{client.status}</Badge>
            <span>{t(locale, 'clientDetail.contracted')}: {formatDate(client.created_at)}</span>
          </div>
        </div>
      </Card>

      {/* Active packs by section */}
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3 mb-6">
        {PACK_TYPE_ORDER.map((type) => {
          const items = grouped[type]
          return (
            <Card key={type} className="overflow-hidden">
              <div className="border-b border-line px-5 py-4">
                <h3 className="font-bold text-foreground">{t(locale, SECTION_KEY[type])}</h3>
              </div>
              {items.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">{t(locale, 'clientDetail.empty')}</p>
              ) : (
                <div className="divide-y divide-line">
                  {items.map((pack) => {
                    const summary = summaryMap.get(pack.id)
                    return (
                      <div key={pack.id} className="px-5 py-4">
                        <p className="font-semibold text-foreground">{pack.name}</p>
                        <p className="mt-1 text-xs text-muted">{t(locale, 'clientDetail.contracted')}: {formatDate(pack.purchase_date)}</p>
                        {pack.renewal_date && (
                          <p className="text-xs text-muted">{t(locale, 'clientDetail.renewal')}: {formatDate(pack.renewal_date)}</p>
                        )}
                        {type === 'hours' && (
                          <div className="mt-2 flex gap-4 text-xs">
                            <span className="font-medium text-emerald-700">{t(locale, 'clientDetail.remaining')}: {formatDuration(summary?.remaining_minutes ?? 0)}</span>
                            <span className="text-muted">{t(locale, 'clientDetail.total')}: {formatDuration(pack.minutes_total)}</span>
                          </div>
                        )}
                        {pack.price && (
                          <p className="mt-1 text-xs text-muted">{pack.price.toFixed(2)} €</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Recent activities */}
      {recentActivities.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-6 py-4">
            <h3 className="font-bold text-foreground">Actividad reciente</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-6 py-3">Título</th>
                  <th className="px-6 py-3">Pack</th>
                  <th className="px-6 py-3">Tipo</th>
                  <th className="px-6 py-3">Horas</th>
                  <th className="px-6 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recentActivities.map((activity) => (
                  <tr key={activity.id}>
                    <td className="px-6 py-3 font-medium text-foreground">{activity.title}</td>
                    <td className="px-6 py-3 text-muted">{(activity.packs as { name: string } | null)?.name ?? '—'}</td>
                    <td className="px-6 py-3 text-muted">{activity.activity_type}</td>
                    <td className="px-6 py-3 text-muted">{activity.minutes_used > 0 ? formatDuration(activity.minutes_used) : '—'}</td>
                    <td className="px-6 py-3 text-muted">{formatDate(activity.work_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Inactive packs (collapsed) */}
      {inactivePacks.length > 0 && (
        <Card className="mt-6 overflow-hidden opacity-60">
          <div className="border-b border-line px-6 py-4">
            <h3 className="font-bold text-foreground">Historial inactivo ({inactivePacks.length})</h3>
          </div>
          <div className="divide-y divide-line">
            {inactivePacks.map((pack) => (
              <div key={pack.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{pack.name}</p>
                  <p className="text-xs text-muted">{pack.pack_type} · {formatDate(pack.purchase_date)}</p>
                </div>
                <Badge className="bg-slate-100 text-slate-500">{pack.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </AdminShell>
  )
}
