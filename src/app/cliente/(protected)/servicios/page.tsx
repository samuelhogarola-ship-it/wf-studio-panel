import Link from 'next/link'
import { requireClientAccess } from '@/lib/auth'
import { getClientServicesData } from '@/lib/data/client'
import { ClientShell } from '@/components/layout/client-shell'
import { RequestForm } from '@/components/client/request-form'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-blue-50 text-blue-700',
  cancelled: 'bg-slate-100 text-slate-500',
}

const TYPE_LABELS: Record<string, string> = {
  bono_horas: 'Bono horas', pack_cerrado: 'Pack cerrado', diseño: 'Diseño',
  desarrollo: 'Desarrollo', seo: 'SEO', marketing: 'Marketing',
  dominio: 'Dominio', hosting: 'Hosting', mantenimiento: 'Mantenimiento',
  consultoria: 'Consultoría', otro: 'Otro',
}

export default async function ClientServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>
}) {
  const identity = await requireClientAccess()
  const params = await searchParams
  const showForm = params.new === '1'
  const services = await getClientServicesData(identity.client.id)

  return (
    <ClientShell clientName={identity.client.name} clientEmail={identity.email}>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Mis servicios</h1>
          <p className="mt-0.5 text-slate-500 text-sm">Servicios contratados con WF-Studio.</p>
        </div>
        <Link
          href="/cliente/servicios?new=1"
          className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
        >
          <span className="text-base leading-none">+</span> Contratar servicio
        </Link>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-foreground">Solicitar nuevo servicio</h2>
            <Link
              href="/cliente/servicios"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 text-lg leading-none"
            >
              ×
            </Link>
          </div>
          <RequestForm type="solicitud_servicio" />
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {services.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-slate-400 text-sm mb-3">No tienes servicios contratados todavía.</p>
            <Link href="/cliente/servicios?new=1" className="text-sm font-semibold text-brand hover:underline">
              Solicitar un servicio →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {services.map((s) => (
              <div key={s.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{s.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-400">{TYPE_LABELS[s.service_type] ?? s.service_type}</span>
                    {s.notes && <span className="text-xs text-slate-400 truncate">· {s.notes}</span>}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-3 text-right">
                  {s.price != null && (
                    <span className="text-sm font-semibold text-foreground">{s.price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                  )}
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[s.status] ?? 'bg-slate-100 text-slate-500'}`}>
                    {s.status === 'active' ? 'Activo' : s.status === 'completed' ? 'Completado' : 'Cancelado'}
                  </span>
                  <span className="text-xs text-slate-400">{formatDate(s.service_date)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ClientShell>
  )
}
