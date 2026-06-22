import Link from 'next/link'

import { ClientForm } from '@/components/admin/client-form'
import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { deactivateClientAction } from '@/lib/actions/admin'
import { requireAdmin } from '@/lib/auth'
import { getAdminClientsPageData } from '@/lib/data/admin'
import { formatDate, formatHours } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; edit?: string }>
}) {
  const identity = await requireAdmin()
  const params = await searchParams
  const data = await getAdminClientsPageData(params.q ?? '', params.edit)
  const summaryMap = new Map(data.summaries.map((item) => [item.client_id, item]))

  return (
    <AdminShell title="Clientes" description="Alta, edición, desactivación y búsqueda de clientes del estudio." currentPath="/paneladmin/clientes" userEmail={identity.email}>
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <ClientForm editingClient={data.editingClient} />

        <Card className="overflow-hidden">
          <div className="border-b border-line px-6 py-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">Base de clientes</h2>
                <p className="text-sm text-muted">Búsqueda rápida y estado actual de horas por cliente.</p>
              </div>
              <form className="flex gap-2" action="/paneladmin/clientes">
                <input
                  type="search"
                  name="q"
                  defaultValue={params.q ?? ''}
                  placeholder="Buscar por nombre, empresa o email"
                  className="min-h-11 rounded-full border border-line bg-white px-4 text-sm text-foreground outline-none focus:border-brand"
                />
                <button className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">Buscar</button>
              </form>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Horas restantes</th>
                  <th className="px-6 py-4">Creado</th>
                  <th className="px-6 py-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.clients.map((client) => {
                  const summary = summaryMap.get(client.id)

                  return (
                    <tr key={client.id}>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-foreground">{client.name}</p>
                        <p className="text-slate-500">{client.company || client.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={client.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}>{client.status}</Badge>
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground">{formatHours(summary?.remaining_hours ?? 0)}</td>
                      <td className="px-6 py-4 text-slate-500">{formatDate(client.created_at)}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/paneladmin/clientes?edit=${client.id}`} className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
                            Editar
                          </Link>
                          {client.status === 'active' ? (
                            <form action={deactivateClientAction}>
                              <input type="hidden" name="id" value={client.id} />
                              <button className="rounded-full bg-rose-50 px-3 py-2 font-semibold text-rose-700">Desactivar</button>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {data.clients.length === 0 ? <p className="px-6 py-8 text-sm text-muted">No se han encontrado clientes con ese criterio.</p> : null}
          </div>
        </Card>
      </div>
    </AdminShell>
  )
}
