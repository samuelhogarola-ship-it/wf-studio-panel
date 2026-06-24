import Link from 'next/link'

import { ServiceForm } from '@/components/admin/service-form'
import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getAdminServicesPageData } from '@/lib/data/admin'
import { getLocale } from '@/lib/locale'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-blue-50 text-blue-700',
  cancelled: 'bg-slate-100 text-slate-500',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

const TYPE_LABELS: Record<string, string> = {
  bono_horas: 'Bono horas',
  pack_cerrado: 'Pack cerrado',
  diseño: 'Diseño',
  desarrollo: 'Desarrollo',
  seo: 'SEO',
  marketing: 'Marketing',
  dominio: 'Dominio',
  hosting: 'Hosting',
  mantenimiento: 'Mantenimiento',
  consultoria: 'Consultoría',
  otro: 'Otro',
}

export default async function AdminServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string; client?: string }>
}) {
  const identity = await requireAdmin()
  const params = await searchParams
  const showNew = params.new === '1' || !!params.edit
  const activeClient = params.client ?? ''
  const data = await getAdminServicesPageData()
  const locale = await getLocale()

  const editingService = params.edit
    ? (data.services.find((s) => s.id === params.edit) ?? null)
    : null

  const filteredServices = activeClient
    ? data.services.filter((s) => s.client_id === activeClient)
    : data.services

  const uniqueClients = data.clients.filter((c) =>
    data.services.some((s) => s.client_id === c.id)
  )

  return (
    <AdminShell
      title="Servicios"
      description="Registro de todos los servicios contratados por cliente."
      currentPath="/paneladmin/servicios"
      userEmail={identity.email}
      locale={locale}
    >
      {/* Client filter + new button */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex gap-1.5 overflow-x-auto">
          <Link
            href="/paneladmin/servicios"
            className={cn(
              'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition',
              !activeClient ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            Todos
          </Link>
          {uniqueClients.map((c) => (
            <Link
              key={c.id}
              href={`/paneladmin/servicios?client=${c.id}`}
              className={cn(
                'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition',
                activeClient === c.id ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {c.name}
            </Link>
          ))}
        </div>
        <Link
          href={`/paneladmin/servicios?new=1${activeClient ? `&client=${activeClient}` : ''}`}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition"
        >
          <span className="text-base leading-none">+</span> Nuevo servicio
        </Link>
      </div>

      {/* Form panel */}
      {showNew && (
        <div className="mb-6 rounded-xl border border-line bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">
              {editingService ? 'Editar servicio' : 'Nuevo servicio'}
            </h2>
            <Link
              href="/paneladmin/servicios"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition text-lg leading-none"
            >
              ×
            </Link>
          </div>
          <ServiceForm
            clients={data.clients}
            editingService={editingService ?? null}
          />
        </div>
      )}

      {/* Services list */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-6 py-4">Servicio</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Precio</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredServices.map((service) => (
                <tr key={service.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-foreground">{service.name}</p>
                    {service.notes && (
                      <p className="text-xs text-slate-400 mt-0.5 max-w-xs truncate">{service.notes}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {service.client_name ?? '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {TYPE_LABELS[service.service_type] ?? service.service_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-foreground">
                    {service.price != null ? `${service.price} €` : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <Badge className={STATUS_STYLES[service.status] ?? 'bg-slate-100 text-slate-500'}>
                      {STATUS_LABELS[service.status] ?? service.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{formatDate(service.service_date)}</td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/paneladmin/servicios?edit=${service.id}`}
                      className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredServices.length === 0 && (
            <p className="px-6 py-10 text-sm text-muted">
              {activeClient ? 'No hay servicios para este cliente.' : 'Aún no hay servicios registrados.'}
            </p>
          )}
        </div>
      </Card>
    </AdminShell>
  )
}
