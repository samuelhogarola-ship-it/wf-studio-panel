import Link from 'next/link'
import { requireClientAccess } from '@/lib/auth'
import { getClientBonosData } from '@/lib/data/client'
import { RequestForm } from '@/components/client/request-form'
import { formatDate, formatDuration } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ClientBonosPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>
}) {
  const identity = await requireClientAccess()
  const params = await searchParams
  const showForm = params.new === '1'
  const { packs, summaryMap } = await getClientBonosData(identity.client.id)

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Bonos de horas</h1>
          <p className="mt-0.5 text-slate-500 text-sm">Tus bonos de horas contratados.</p>
        </div>
        <Link
          href="/cliente/bonos?new=1"
          className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
        >
          <span className="text-base leading-none">+</span> Solicitar bono
        </Link>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-foreground">Solicitar nuevo bono de horas</h2>
            <Link
              href="/cliente/bonos"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 text-lg leading-none"
            >
              ×
            </Link>
          </div>
          <RequestForm type="solicitud_bono" />
        </div>
      )}

      <div className="grid gap-4">
        {packs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <p className="text-slate-400 text-sm mb-3">No tienes bonos de horas contratados.</p>
            <Link href="/cliente/bonos?new=1" className="text-sm font-semibold text-brand hover:underline">
              Solicitar un bono →
            </Link>
          </div>
        ) : (
          packs.map((pack) => {
            const summary = summaryMap.get(pack.id)
            const total = Number(pack.minutes_total)
            const used = Number(summary?.used_minutes ?? 0)
            const remaining = Math.max(0, total - used)
            const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0

            return (
              <div key={pack.id} className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-bold text-foreground">{pack.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Comprado el {formatDate(pack.purchase_date)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pack.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {pack.status === 'active' ? 'Activo' : pack.status}
                  </span>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-500">Usadas: <span className="font-semibold text-foreground">{formatDuration(used)}</span></span>
                    <span className="text-slate-500">Restantes: <span className={`font-semibold ${remaining === 0 ? 'text-red-600' : 'text-brand'}`}>{formatDuration(remaining)}</span></span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100">
                    <div
                      className={`h-2.5 rounded-full transition-all ${pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-brand'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
                    <span>{pct}% consumido de {formatDuration(total)}</span>
                    {remaining < total * 0.2 && remaining > 0 && (
                      <Link href="/cliente/bonos?new=1" className="font-semibold text-brand hover:underline">
                        Renovar bono →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
