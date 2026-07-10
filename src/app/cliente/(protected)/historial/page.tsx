import Link from 'next/link'
import { requireClientAccess } from '@/lib/auth'
import { getClientHistorialData } from '@/lib/data/client'
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

const PAGE_SIZE = 30

export default async function ClientHistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const identity = await requireClientAccess()
  const params = await searchParams
  const page = Math.max(0, parseInt(params.page ?? '0', 10) || 0)

  const { activities, total } = await getClientHistorialData(identity.client.id, page, PAGE_SIZE)

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasPrev = page > 0
  const hasNext = page < totalPages - 1

  // Group activities by month
  const grouped = new Map<string, typeof activities>()
  for (const a of activities) {
    const d = new Date(a.work_date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(a)
  }

  const monthLabel = (key: string) => {
    const [year, month] = key.split('-')
    const d = new Date(parseInt(year), parseInt(month) - 1, 1)
    return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Historial de actividad</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {total > 0 ? `${total} trabajos registrados en total.` : 'Todo el trabajo realizado en tus proyectos.'}
          </p>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <p className="text-slate-400 text-sm">Aún no hay actividad registrada.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-8">
            {Array.from(grouped.entries()).map(([key, items]) => {
              const monthMinutes = items.reduce((sum, a) => sum + (a.minutes_used ?? 0), 0)
              return (
                <section key={key}>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 capitalize">
                      {monthLabel(key)}
                    </h2>
                    {monthMinutes > 0 && (
                      <span className="text-xs font-semibold text-slate-500">{formatDuration(monthMinutes)} trabajadas</span>
                    )}
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
                    {items.map((activity) => {
                      const packName = !Array.isArray(activity.packs) ? activity.packs?.name : null
                      return (
                        <div key={activity.id} className="flex items-start justify-between gap-4 px-5 py-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ACTIVITY_COLORS[activity.activity_type] ?? 'bg-slate-100 text-slate-500'}`}>
                                {activity.activity_type}
                              </span>
                              {packName && (
                                <span className="text-xs text-slate-400 truncate">{packName}</span>
                              )}
                            </div>
                            <p className="font-semibold text-foreground">{activity.title}</p>
                            {activity.description && (
                              <p className="mt-0.5 text-sm text-slate-500 line-clamp-2">{activity.description}</p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            {activity.minutes_used > 0 && (
                              <p className="font-semibold text-foreground">{formatDuration(activity.minutes_used)}</p>
                            )}
                            <p className="text-xs text-slate-400">{formatDate(activity.work_date)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between gap-4">
              <span className="text-sm text-slate-400">
                Página {page + 1} de {totalPages}
              </span>
              <div className="flex gap-2">
                {hasPrev && (
                  <Link
                    href={`/cliente/historial?page=${page - 1}`}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    ← Anterior
                  </Link>
                )}
                {hasNext && (
                  <Link
                    href={`/cliente/historial?page=${page + 1}`}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Siguiente →
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
