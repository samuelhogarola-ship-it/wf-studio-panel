import Link from 'next/link'
import { requireClientAccess } from '@/lib/auth'
import { getClientDashboardData, getClientFacturasData } from '@/lib/data/client'
import { formatDate, formatDuration } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const ACTIVITY_COLORS: Record<string, string> = {
  web: 'bg-blue-50 text-blue-700',
  seo: 'bg-violet-50 text-violet-700',
  hosting: 'bg-slate-100 text-slate-600',
  marketing: 'bg-orange-50 text-orange-700',
  soporte: 'bg-yellow-50 text-yellow-700',
  desarrollo: 'bg-emerald-50 text-emerald-700',
  reunion: 'bg-pink-50 text-pink-700',
  otro: 'bg-slate-100 text-slate-500',
}

function isExpired(renewalDate: string | null) {
  if (!renewalDate) return false
  return new Date(renewalDate) < new Date()
}

export default async function ClientDashboardPage() {
  const identity = await requireClientAccess()
  const [data, invoices] = await Promise.all([
    getClientDashboardData(identity.client.id),
    getClientFacturasData(identity.client.id),
  ])

  const pendingInvoices = invoices.filter((i) => i.status === 'pending')
  const pendingTotal = pendingInvoices.reduce((sum, i) => sum + Number(i.amount ?? 0), 0)
  const expiredPacks = data.closedPacks.filter((p) => isExpired(p.renewal_date))
  const pendingItems = data.pendingItems.filter((item) => item.status === 'pending')

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-foreground">
          Hola, {identity.client.name}
        </h1>
        <p className="mt-1 text-slate-500">Estado de tus servicios con WF-Studio.</p>
      </div>

      {/* Alerts */}
      {(pendingInvoices.length > 0 || expiredPacks.length > 0 || pendingItems.length > 0) && (
        <div className="mb-6 grid gap-3">
          {pendingItems.length > 0 && (
            <Link
              href="/cliente/pendientes"
              className="flex items-center gap-4 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 hover:bg-sky-100 transition"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-sky-700">
                  <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sky-900">
                  {pendingItems.length === 1 ? 'Tienes 1 dato pendiente por enviar' : `Tienes ${pendingItems.length} datos pendientes por enviar`}
                </p>
                <p className="text-sm text-sky-700">Ver checklist →</p>
              </div>
            </Link>
          )}
          {pendingInvoices.length > 0 && (
            <Link
              href="/cliente/facturas"
              className="flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 hover:bg-amber-100 transition"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-900">
                  {pendingInvoices.length === 1
                    ? `1 factura pendiente · ${pendingTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`
                    : `${pendingInvoices.length} facturas pendientes · ${pendingTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`}
                </p>
                <p className="text-sm text-amber-700">Ver facturas →</p>
              </div>
            </Link>
          )}
          {expiredPacks.map((pack) => (
            <div key={pack.id} className="flex items-center gap-4 rounded-2xl border border-red-100 bg-red-50 px-5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                  <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-red-900">{pack.name} · Expirado el {formatDate(pack.renewal_date!)}</p>
                <p className="text-sm text-red-700">Contacta con el estudio para renovar.</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hours bonos */}
      {data.hoursPacks.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Bonos de horas</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {data.hoursPacks.map((pack) => {
              const summary = data.summaryMap.get(pack.id)
              const total = Number(pack.minutes_total)
              const used = Number(summary?.used_minutes ?? 0)
              const remaining = Math.max(0, total - used)
              const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
              return (
                <div key={pack.id} className="rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-bold text-foreground">{pack.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Bono de horas</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Activo</span>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-slate-500">Usadas: <span className="font-semibold text-foreground">{formatDuration(used)}</span></span>
                      <span className="text-slate-500">Restantes: <span className={`font-semibold ${remaining === 0 ? 'text-red-600' : 'text-brand'}`}>{formatDuration(remaining)}</span></span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-100">
                      <div className={`h-2.5 rounded-full transition-all ${pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-right text-xs text-slate-400">{pct}% consumido de {formatDuration(total)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Active services (non-hours) */}
      {data.closedPacks.filter((p) => !isExpired(p.renewal_date)).length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Servicios activos</h2>
          <div className="grid gap-3">
            {data.closedPacks.filter((p) => !isExpired(p.renewal_date)).map((pack) => (
              <div key={pack.id} className="rounded-2xl border border-slate-200 bg-white px-6 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-foreground">{pack.name}</p>
                  {pack.notes && <p className="mt-0.5 text-sm text-slate-500 line-clamp-1">{pack.notes}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Activo</span>
                  {pack.renewal_date && <span className="text-xs text-slate-400 hidden sm:block">Renueva {formatDate(pack.renewal_date)}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.hoursPacks.length === 0 && data.closedPacks.length === 0 && (
        <div className="mb-8 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-slate-400 mb-3">Aún no tienes ningún servicio activo.</p>
          <Link href="/cliente/servicios?new=1" className="text-sm font-semibold text-brand hover:underline">
            Solicitar un servicio →
          </Link>
        </div>
      )}

      {/* Recent activity */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Actividad reciente</h2>
          {data.activities.length > 0 && (
            <Link href="/cliente/historial" className="text-xs font-semibold text-brand hover:underline">
              Ver todo →
            </Link>
          )}
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {data.activities.length === 0 ? (
            <p className="px-6 py-10 text-sm text-center text-slate-400">Aún no hay actividad registrada.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.activities.map((activity) => (
                <div key={activity.id} className="flex items-start justify-between gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ACTIVITY_COLORS[activity.activity_type] ?? 'bg-slate-100 text-slate-500'}`}>
                        {activity.activity_type}
                      </span>
                      {!Array.isArray(activity.packs) && activity.packs?.name && (
                        <span className="text-xs text-slate-400 truncate">{activity.packs.name}</span>
                      )}
                    </div>
                    <p className="font-semibold text-foreground">{activity.title}</p>
                    {activity.description && <p className="mt-0.5 text-sm text-slate-500 line-clamp-2">{activity.description}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    {activity.minutes_used > 0 && <p className="font-semibold text-foreground">{formatDuration(activity.minutes_used)}</p>}
                    <p className="text-xs text-slate-400">{formatDate(activity.work_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
