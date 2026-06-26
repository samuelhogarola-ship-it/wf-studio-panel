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
import { togglePackPaidAction, togglePackStatusAction } from '@/lib/actions/admin'

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

const SECTION_NAV_LABEL: Record<PackType, string> = {
  hours: 'Bonos',
  tasks: 'Tareas',
  domain: 'Dominios',
  hosting: 'Hosting',
  service: 'Servicios',
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
      <div className="mb-6 flex items-center justify-between">
        <Link href="/paneladmin/clientes" className="text-sm font-semibold text-brand hover:underline">
          ← {t(locale, 'clientDetail.back')}
        </Link>
        <div className="flex gap-2">
          <Link
            href={`/paneladmin/clientes/${client.id}/print/servicios`}
            target="_blank"
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Informe servicios →
          </Link>
          <Link
            href={`/paneladmin/clientes/${client.id}/print/historial`}
            target="_blank"
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Informe historial →
          </Link>
        </div>
      </div>

      {/* Client info */}
      <Card className="mb-4 p-6">
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

      {/* Section nav */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1.5">
        {PACK_TYPE_ORDER.filter((type) => grouped[type].length > 0).map((type) => (
          <a
            key={type}
            href={`#section-${type}`}
            className="whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            {SECTION_NAV_LABEL[type]}
            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-500">{grouped[type].length}</span>
          </a>
        ))}
        {recentActivities.length > 0 && (
          <a href="#section-actividad" className="whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
            Actividad
          </a>
        )}
      </div>

      {/* Active packs by section */}
      <Card className="mb-6 overflow-hidden">
        {PACK_TYPE_ORDER.filter((type) => grouped[type].length > 0).map((type, sectionIdx, arr) => {
          const items = grouped[type]
          return (
            <div key={type} id={`section-${type}`} className={`scroll-mt-4 ${sectionIdx < arr.length - 1 ? 'border-b border-line' : ''}`}>
              <div className="px-5 py-3 bg-slate-50">
                <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-muted">{t(locale, SECTION_KEY[type])}</h3>
              </div>
              <div className="divide-y divide-line">
                {items.map((pack) => {
                  const summary = summaryMap.get(pack.id)
                  return (
                    <div key={pack.id} className="flex items-center justify-between gap-4 px-5 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{pack.name}</p>
                          {pack.billing_cycle === 'monthly' && (
                            <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-600">Mensual</span>
                          )}
                        </div>
                        {pack.renewal_date && (
                          <p className="text-xs text-muted">{(type === 'domain' || type === 'hosting') ? 'Caduca' : 'Renueva'}: {formatDate(pack.renewal_date)}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-xs">
                        {type === 'hours' && (
                          <span className="font-medium text-emerald-700">{formatDuration(summary?.remaining_minutes ?? 0)} restantes</span>
                        )}
                        {pack.price && <span className="font-semibold text-foreground">{pack.price.toFixed(2)} €</span>}
                        {/* Status toggle (solo para servicios one_time) */}
                        {(type === 'service' || type === 'tasks') && pack.billing_cycle !== 'monthly' && (
                          <form action={togglePackStatusAction}>
                            <input type="hidden" name="pack_id" value={pack.id} />
                            <input type="hidden" name="status" value={pack.status} />
                            <input type="hidden" name="client_id" value={client.id} />
                            <button type="submit" title="Cambiar estado" className={`cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition hover:opacity-70 ${pack.status === 'active' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                              {pack.status === 'active' ? '⏳ En progreso' : '✓ Completado'}
                            </button>
                          </form>
                        )}
                        {/* Paid toggle */}
                        <form action={togglePackPaidAction}>
                          <input type="hidden" name="pack_id" value={pack.id} />
                          <input type="hidden" name="paid" value={String(pack.paid)} />
                          <input type="hidden" name="client_id" value={client.id} />
                          <button type="submit" title="Marcar como pagado / no pagado" className={`cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition hover:opacity-70 ${pack.paid ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-500'}`}>
                            {pack.paid ? '✓ Pagado' : '✗ No pagado'}
                          </button>
                        </form>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </Card>

      {/* Recent activities */}
      {recentActivities.length > 0 && (
        <Card id="section-actividad" className="overflow-hidden scroll-mt-4">
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
