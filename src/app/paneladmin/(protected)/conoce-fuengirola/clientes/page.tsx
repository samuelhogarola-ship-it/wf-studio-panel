import Link from 'next/link'

import { ClientForm } from '@/components/admin/client-form'
import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { approveClientAction, deactivateClientAction, rejectClientAction } from '@/lib/actions/admin'
import { requireAdmin } from '@/lib/auth'
import { getAdminClientsPageData } from '@/lib/data/admin'
import { getLocale } from '@/lib/locale'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const PROJECT = 'conoce-fuengirola'
const BASE = '/paneladmin/conoce-fuengirola/clientes'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; edit?: string; new?: string }>
}) {
  const identity = await requireAdmin()
  const params = await searchParams
  const showNew = params.new === '1' || !!params.edit
  const locale = await getLocale()
  const data = await getAdminClientsPageData(params.q ?? '', params.edit, '', PROJECT)

  return (
    <AdminShell
      title="Clientes — Conoce Fuengirola"
      description="Base de datos de clientes y suscriptores"
      currentPath="/paneladmin/conoce-fuengirola/clientes"
      userEmail={identity.email}
      locale={locale}
    >
      {data.pendingClients.length > 0 && (
        <Card className="mb-6 overflow-hidden border-amber-200">
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-4">
            <h2 className="font-bold text-amber-900">Solicitudes pendientes ({data.pendingClients.length})</h2>
          </div>
          <div className="divide-y divide-line">
            {data.pendingClients.map((client) => (
              <div key={client.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-semibold text-foreground">{client.name}</p>
                  <p className="text-sm text-muted">{client.email}</p>
                </div>
                <div className="flex gap-2">
                  <form action={approveClientAction}>
                    <input type="hidden" name="id" value={client.id} />
                    <button className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Aprobar</button>
                  </form>
                  <form action={rejectClientAction}>
                    <input type="hidden" name="id" value={client.id} />
                    <button className="rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">Rechazar</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-6 flex items-center justify-between gap-3">
        <form action={BASE}>
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Buscar cliente…"
            className="h-8 rounded-full border border-line bg-white px-3 text-xs text-foreground outline-none focus:border-brand"
          />
        </form>
        <Link
          href={`${BASE}?new=1`}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition"
        >
          <span className="text-base leading-none">+</span> Nuevo cliente
        </Link>
      </div>

      {showNew && (
        <div className="mb-6 rounded-xl border border-line bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">{params.edit ? 'Editar cliente' : 'Nuevo cliente'}</h2>
            <Link href={BASE} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition text-lg leading-none">×</Link>
          </div>
          <ClientForm editingClient={data.editingClient} locale={locale} project={PROJECT} />
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Alta</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.clients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-foreground">{client.name}</p>
                    <p className="text-xs text-slate-400">{client.company || client.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <Badge className={cn(client.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                      {client.status === 'active' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{formatDate(client.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <Link href={`${BASE}?edit=${client.id}`} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition">
                        Editar
                      </Link>
                      {client.status === 'active' && (
                        <form action={deactivateClientAction}>
                          <input type="hidden" name="id" value={client.id} />
                          <button className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition">Desactivar</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.clients.length === 0 && <p className="px-6 py-10 text-sm text-muted">No hay clientes todavía.</p>}
        </div>
      </Card>
    </AdminShell>
  )
}
