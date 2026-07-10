import Link from 'next/link'
import { requireClientAccess } from '@/lib/auth'
import { getClientServicesData } from '@/lib/data/client'
import { RequestForm } from '@/components/client/request-form'
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

const RENEWABLE_TYPES = new Set(['domain', 'hosting', 'subscription', 'membership', 'service'])

const TYPE_LABELS: Record<string, string> = {
  hours: 'Bono de horas',
  tasks: 'Pack cerrado',
  domain: 'Dominio',
  hosting: 'Hosting',
  service: 'Servicio',
  subscription: 'Suscripción',
  membership: 'Membresía',
}

const TYPE_COLORS: Record<string, string> = {
  hours: 'bg-brand/10 text-brand',
  tasks: 'bg-violet-50 text-violet-700',
  domain: 'bg-sky-50 text-sky-700',
  hosting: 'bg-emerald-50 text-emerald-700',
  service: 'bg-orange-50 text-orange-700',
  subscription: 'bg-indigo-50 text-indigo-700',
  membership: 'bg-pink-50 text-pink-700',
}

function isExpired(renewalDate: string | null) {
  if (!renewalDate) return false
  return new Date(renewalDate) < new Date()
}

function StatusBadge({ status, renewalDate }: { status: string; renewalDate: string | null; paid?: boolean | null }) {
  if (status !== 'active') {
    return <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">Inactivo</span>
  }
  if (isExpired(renewalDate)) {
    return <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">Expirado</span>
  }
  return <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Activo</span>
}

function PaidBadge({ paid }: { paid: boolean | null }) {
  if (paid === null) return null
  return paid
    ? <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Pagado</span>
    : <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Pendiente de pago</span>
}

function PackCard({ pack, openId }: {
  pack: {
    id: string
    name: string
    pack_type: string
    status: string
    purchase_date: string | null
    price: number | null
    notes: string | null
    minutes_total: number | null
    renewal_date: string | null
    paid?: boolean | null
    summary: { used_minutes: number | null; remaining_minutes: number | null; minutes_total: number | null } | null
    recentActivities: { id: string; title: string; activity_type: string; minutes_used: number; work_date: string }[]
  }
  openId: string | null
}) {
  const isOpen = openId === pack.id
  const isHours = pack.pack_type === 'hours'
  const total = Number(pack.minutes_total ?? 0)
  const used = Number(pack.summary?.used_minutes ?? 0)
  const remaining = Math.max(0, total - used)
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const expired = isExpired(pack.renewal_date)

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white ${expired ? 'border-red-100' : 'border-slate-200'}`}>
      <Link
        href={isOpen ? '/cliente/servicios' : `/cliente/servicios?open=${pack.id}`}
        className="flex items-center justify-between gap-4 px-6 py-5 hover:bg-slate-50 transition"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_COLORS[pack.pack_type] ?? 'bg-slate-100 text-slate-600'}`}>
              {TYPE_LABELS[pack.pack_type] ?? pack.pack_type}
            </span>
            <StatusBadge status={pack.status} renewalDate={pack.renewal_date} paid={pack.paid ?? null} />
            <PaidBadge paid={pack.paid ?? null} />
          </div>
          <p className="font-bold text-foreground">{pack.name}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-400">
            {pack.purchase_date && <span>Contratado el {formatDate(pack.purchase_date)}</span>}
            {pack.price != null && (
              <span className="font-semibold text-slate-600">
                {pack.price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
              </span>
            )}
            {pack.renewal_date && (
              <span className={expired ? 'text-red-500 font-semibold' : ''}>
                {expired ? `Expiró el ${formatDate(pack.renewal_date)}` : `Renueva el ${formatDate(pack.renewal_date)}`}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isHours && total > 0 && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-400">Restantes</p>
              <p className={`text-sm font-bold ${remaining === 0 ? 'text-red-600' : 'text-brand'}`}>
                {formatDuration(remaining)}
              </p>
            </div>
          )}
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </Link>

      {isOpen && (
        <div className="border-t border-slate-100 px-6 py-5">
          {isHours && total > 0 && (
            <div className="mb-5">
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
              <p className="mt-1 text-right text-xs text-slate-400">{pct}% consumido de {formatDuration(total)}</p>
            </div>
          )}

          {pack.notes && (
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 mb-2">Qué incluye</p>
              <p className="text-sm text-slate-600 leading-relaxed">{pack.notes}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 mb-3">Últimos trabajos</p>
            {pack.recentActivities.length === 0 ? (
              <p className="text-sm text-slate-400">Sin actividad registrada.</p>
            ) : (
              <div className="grid gap-2">
                {pack.recentActivities.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${ACTIVITY_COLORS[a.activity_type] ?? 'bg-slate-100 text-slate-500'}`}>
                        {a.activity_type}
                      </span>
                      <span className="text-sm font-medium text-foreground truncate">{a.title}</span>
                    </div>
                    <div className="shrink-0 text-right">
                      {a.minutes_used > 0 && <p className="text-xs font-semibold text-foreground">{formatDuration(a.minutes_used)}</p>}
                      <p className="text-xs text-slate-400">{formatDate(a.work_date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isHours && remaining < total * 0.2 && remaining > 0 && (
            <div className="mt-4">
              <Link
                href="/cliente/servicios?new=1"
                className="inline-flex rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
              >
                Solicitar más horas →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default async function ClientServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; open?: string }>
}) {
  const identity = await requireClientAccess()
  const params = await searchParams
  const showForm = params.new === '1'
  const openId = params.open ?? null
  const { packs } = await getClientServicesData(identity.client.id)

  const hoursPacks = packs.filter((p) => p.pack_type === 'hours')
  const renewablePacks = packs.filter((p) => RENEWABLE_TYPES.has(p.pack_type))
  const closedPacks = packs.filter((p) => p.pack_type === 'tasks')

  const hasAny = packs.length > 0

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Mis servicios</h1>
          <p className="mt-0.5 text-sm text-slate-500">Bonos de horas, servicios activos y trabajos contratados.</p>
        </div>
        <Link
          href="/cliente/servicios?new=1"
          className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
        >
          <span className="text-base leading-none">+</span> Solicitar
        </Link>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-foreground">Solicitar nuevo servicio</h2>
            <Link
              href="/cliente/servicios"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 text-lg leading-none"
            >×</Link>
          </div>
          <RequestForm type="solicitud_servicio" />
        </div>
      )}

      {!hasAny && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <p className="text-slate-400 text-sm mb-3">No tienes servicios contratados todavía.</p>
          <Link href="/cliente/servicios?new=1" className="text-sm font-semibold text-brand hover:underline">
            Solicitar un servicio →
          </Link>
        </div>
      )}

      {hoursPacks.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Bonos de horas</h2>
          <div className="grid gap-3">
            {hoursPacks.map((pack) => (
              <PackCard key={pack.id} pack={pack} openId={openId} />
            ))}
          </div>
        </section>
      )}

      {renewablePacks.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Servicios activos y renovables</h2>
          <div className="grid gap-3">
            {renewablePacks.map((pack) => (
              <PackCard key={pack.id} pack={pack} openId={openId} />
            ))}
          </div>
        </section>
      )}

      {closedPacks.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Trabajos contratados</h2>
          <div className="grid gap-3">
            {closedPacks.map((pack) => (
              <PackCard key={pack.id} pack={pack} openId={openId} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
