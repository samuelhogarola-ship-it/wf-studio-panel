import { requireClientAccess } from '@/lib/auth'
import { getClientPendingItems } from '@/lib/data/client'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function getPendingStatusMeta(status: string) {
  if (status === 'received') {
    return {
      label: 'Recibido',
      className: 'bg-emerald-50 text-emerald-700',
      description: 'Ya lo hemos recibido y revisado en el panel.',
    }
  }

  return {
    label: 'Pendiente',
    className: 'bg-amber-50 text-amber-700',
    description: 'Todavía necesitamos que nos lo envíes.',
  }
}

export default async function ClientPendingItemsPage() {
  const identity = await requireClientAccess()
  const items = await getClientPendingItems(identity.client.id)
  const pendingCount = items.filter((item) => item.status === 'pending').length

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Pendientes</h1>
          <p className="mt-1 text-sm text-slate-500">Aquí puedes ver qué datos, accesos o materiales seguimos necesitando por tu parte.</p>
        </div>
        <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
          {pendingCount === 1 ? '1 pendiente activo' : `${pendingCount} pendientes activos`}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-400">Ahora mismo no tienes ningún dato pendiente por enviarnos.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => {
            const statusMeta = getPendingStatusMeta(item.status)

            return (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-foreground">{item.title}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.className}`}>
                      {statusMeta.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Solicitado el {formatDate(item.requested_at)}
                    {item.received_at ? ` · recibido el ${formatDate(item.received_at)}` : ''}
                  </p>
                  {item.reminder_interval_days ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Recordatorio por email cada {item.reminder_interval_days === 1 ? 'día' : `${item.reminder_interval_days} días`}
                    </p>
                  ) : null}
                  <p className="mt-3 text-sm text-slate-500">{statusMeta.description}</p>
                  {item.description ? <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.description}</p> : null}
                  {item.status === 'pending' ? (
                    <div className="mt-5">
                      <Link
                        href={`/cliente/mensajeria?new=1&pending=${item.id}`}
                        className="inline-flex rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
                      >
                        Enviar este dato
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
