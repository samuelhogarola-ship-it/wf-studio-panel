import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PackActivityForm } from '@/components/admin/pack-activity-form'
import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getPackDetailData } from '@/lib/data/admin'
import { getLocale } from '@/lib/locale'
import { formatDate, formatDuration } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const TYPE_LABELS: Record<string, string> = {
  hours: 'Bono de horas',
  tasks: 'Pack cerrado',
  domain: 'Dominio',
  hosting: 'Hosting',
  service: 'Servicio',
}

const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  web: 'bg-blue-50 text-blue-700',
  seo: 'bg-violet-50 text-violet-700',
  hosting: 'bg-slate-100 text-slate-600',
  marketing: 'bg-orange-50 text-orange-700',
  soporte: 'bg-yellow-50 text-yellow-700',
  desarrollo: 'bg-emerald-50 text-emerald-700',
  reunion: 'bg-pink-50 text-pink-700',
  otro: 'bg-slate-100 text-slate-500',
}

export default async function PackDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ add?: string }>
}) {
  const identity = await requireAdmin()
  const { id } = await params
  const sp = await searchParams
  const showForm = sp.add === '1'
  const { pack, activities, summary } = await getPackDetailData(id)
  const locale = await getLocale()

  if (!pack) notFound()

  const isHoursPack = pack.pack_type === 'hours'
  const client = !Array.isArray(pack.clients) ? pack.clients : null

  const usedMinutes = Number(summary?.used_minutes ?? 0)
  const totalMinutes = Number(pack.minutes_total)
  const remainingMinutes = totalMinutes - usedMinutes
  const pct = totalMinutes > 0 ? Math.min(100, Math.round((usedMinutes / totalMinutes) * 100)) : 0

  return (
    <AdminShell
      title={pack.name}
      description={client?.name ?? ''}
      currentPath="/paneladmin/bonos"
      userEmail={identity.email}
      locale={locale}
    >
      {/* Back */}
      <div className="mb-6">
        <Link
          href="/paneladmin/bonos"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-foreground transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Bonos y packs
        </Link>
      </div>

      {/* Pack header card */}
      <Card className="mb-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {TYPE_LABELS[pack.pack_type] ?? pack.pack_type}
              </span>
              <Badge className={pack.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                {pack.status === 'active' ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            <h2 className="text-2xl font-black text-foreground">{pack.name}</h2>
            {client && (
              <Link href={`/paneladmin/clientes/${client.id}`} className="text-sm text-slate-500 hover:text-foreground hover:underline">
                {client.name}
              </Link>
            )}
          </div>
          <div className="text-right text-sm text-slate-500 space-y-0.5">
            <p>Compra: <span className="font-medium text-foreground">{formatDate(pack.purchase_date)}</span></p>
            {pack.renewal_date && (
              <p>Renovación: <span className="font-medium text-foreground">{formatDate(pack.renewal_date)}</span></p>
            )}
            {pack.price && (
              <p>Precio: <span className="font-medium text-foreground">{pack.price} €</span></p>
            )}
          </div>
        </div>

        {/* Hours progress (only for hours packs) */}
        {isHoursPack && (
          <div className="mt-6">
            <div className="flex justify-between text-sm font-semibold mb-2">
              <span className="text-slate-500">Usadas: {formatDuration(usedMinutes)}</span>
              <span className={remainingMinutes < 0 ? 'text-red-600' : 'text-foreground'}>
                Restantes: {formatDuration(Math.max(0, remainingMinutes))}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100">
              <div
                className={`h-2.5 rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-brand'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-right text-xs text-slate-400">{pct}% consumido de {formatDuration(totalMinutes)}</p>
          </div>
        )}

        {pack.notes && (
          <p className="mt-4 text-sm text-slate-500 border-t border-line pt-4">{pack.notes}</p>
        )}
      </Card>

      {/* Add activity */}
      {showForm ? (
        <Card className="mb-6 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground">Añadir registro</h3>
            <Link
              href={`/paneladmin/bonos/${id}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition text-lg leading-none"
            >
              ×
            </Link>
          </div>
          <PackActivityForm packId={id} clientId={pack.client_id} isHoursPack={isHoursPack} />
        </Card>
      ) : (
        <div className="mb-4 flex justify-end">
          <Link
            href={`/paneladmin/bonos/${id}?add=1`}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
          >
            <span className="text-base leading-none">+</span> Añadir registro
          </Link>
        </div>
      )}

      {/* Activity history */}
      <Card className="overflow-hidden">
        <div className="border-b border-line px-6 py-5">
          <h3 className="text-lg font-bold text-foreground">Historial de registros</h3>
          <p className="text-sm text-muted">{activities.length} {activities.length === 1 ? 'entrada' : 'entradas'}</p>
        </div>

        {activities.length === 0 ? (
          <p className="px-6 py-10 text-sm text-muted">Aún no hay registros en este {isHoursPack ? 'bono' : 'pack'}.</p>
        ) : (
          <div className="divide-y divide-line">
            {activities.map((activity) => (
              <div key={activity.id} className="flex flex-col gap-2 px-6 py-5 md:flex-row md:items-start md:justify-between hover:bg-slate-50 transition-colors">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ACTIVITY_TYPE_COLORS[activity.activity_type] ?? 'bg-slate-100 text-slate-500'}`}>
                      {activity.activity_type}
                    </span>
                    {activity.notify_client && (
                      <span className="text-xs text-slate-400">· notificado</span>
                    )}
                  </div>
                  <p className="font-semibold text-foreground">{activity.title}</p>
                  {activity.description && (
                    <p className="mt-0.5 text-sm text-slate-500">{activity.description}</p>
                  )}
                </div>
                <div className="text-left md:text-right shrink-0">
                  {isHoursPack && activity.minutes_used > 0 && (
                    <p className="font-semibold text-foreground">{formatDuration(activity.minutes_used)}</p>
                  )}
                  <p className="text-sm text-slate-400">{formatDate(activity.work_date)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </AdminShell>
  )
}
