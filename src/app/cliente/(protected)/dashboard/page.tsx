import { requireClientAccess } from '@/lib/auth'
import { getClientDashboardData } from '@/lib/data/client'
import { ClientShell } from '@/components/layout/client-shell'
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

export default async function ClientDashboardPage() {
  const identity = await requireClientAccess()
  const data = await getClientDashboardData(identity.client.id)

  return (
    <ClientShell clientName={identity.client.name} clientEmail={identity.email}>
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-foreground">
          Hola, {identity.client.name} 👋
        </h1>
        <p className="mt-1 text-slate-500">Aquí tienes el estado de tus servicios con WF-Studio.</p>
      </div>

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

      {data.closedPacks.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Packs activos</h2>
          <div className="grid gap-3">
            {data.closedPacks.map((pack) => (
              <div key={pack.id} className="rounded-2xl border border-slate-200 bg-white px-6 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-foreground">{pack.name}</p>
                  {pack.notes && <p className="mt-0.5 text-sm text-slate-500">{pack.notes}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Pack cerrado</span>
                  {pack.renewal_date && <span className="text-xs text-slate-400">Renueva {formatDate(pack.renewal_date)}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.hoursPacks.length === 0 && data.closedPacks.length === 0 && (
        <div className="mb-8 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-slate-400">Aún no tienes ningún bono o pack activo.</p>
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Actividad reciente</h2>
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

      {data.notifications.length > 0 && (
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Notificaciones</h2>
          <div className="grid gap-3">
            {data.notifications.map((n) => (
              <div key={n.id} className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                <p className="font-semibold text-foreground">{n.title}</p>
                {n.body && <p className="mt-1 text-sm text-slate-500">{n.body}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {n.minutes_delta != null && n.minutes_delta !== 0 && (
                    <span className="text-sm font-semibold text-rose-600">−{formatDuration(Math.abs(n.minutes_delta))}</span>
                  )}
                  {n.remaining_minutes != null && (
                    <span className="text-sm font-semibold text-brand">{formatDuration(n.remaining_minutes)} restantes</span>
                  )}
                  <span className="ml-auto text-xs text-slate-400">{formatDate(n.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </ClientShell>
  )
}
