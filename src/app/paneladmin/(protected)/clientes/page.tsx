import Link from 'next/link'

import { ClientForm } from '@/components/admin/client-form'
import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { approveClientAction, deactivateClientAction, rejectClientAction } from '@/lib/actions/admin'
import { requireAdmin } from '@/lib/auth'
import { getAdminClientsPageData } from '@/lib/data/admin'
import { getLocale } from '@/lib/locale'
import { t } from '@/lib/i18n'
import { formatDuration } from '@/lib/utils'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const CATEGORY_TABS = [
  { key: '', label: 'Todos' },
  { key: 'horas', label: 'Bono horas' },
  { key: 'cerrado', label: 'Pack cerrado' },
  { key: 'servicios', label: 'Servicios' },
]

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; edit?: string; new?: string; cat?: string }>
}) {
  const identity = await requireAdmin()
  const params = await searchParams
  const showNew = params.new === '1' || !!params.edit
  const activeCategory = params.cat ?? ''
  const data = await getAdminClientsPageData(params.q ?? '', params.edit, activeCategory)
  const summaryMap = new Map(data.summaries.map((item) => [item.client_id, item]))
  const locale = await getLocale()

  const catParam = activeCategory ? `&cat=${activeCategory}` : ''

  return (
    <AdminShell
      title={t(locale, 'clients.title')}
      description={t(locale, 'clients.description')}
      currentPath="/paneladmin/clientes"
      userEmail={identity.email}
      locale={locale}
    >
      {/* Pending clients */}
      {data.pendingClients.length > 0 && (
        <Card className="mb-6 overflow-hidden border-amber-200">
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-4">
            <h2 className="font-bold text-amber-900">{t(locale, 'clients.pending.title')} ({data.pendingClients.length})</h2>
            <p className="text-sm text-amber-700">{t(locale, 'clients.pending.description')}</p>
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
                    <button className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">{t(locale, 'clients.pending.approve')}</button>
                  </form>
                  <form action={rejectClientAction}>
                    <input type="hidden" name="id" value={client.id} />
                    <button className="rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">{t(locale, 'clients.pending.reject')}</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filter tabs + search + new button */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 overflow-x-auto">
          {CATEGORY_TABS.map((tab) => (
            <Link
              key={tab.key}
              href={tab.key ? `/paneladmin/clientes?cat=${tab.key}` : '/paneladmin/clientes'}
              className={cn(
                'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition',
                activeCategory === tab.key
                  ? 'bg-brand text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <form className="flex gap-2" action="/paneladmin/clientes">
            {activeCategory && <input type="hidden" name="cat" value={activeCategory} />}
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Buscar cliente…"
              className="h-8 rounded-full border border-line bg-white px-3 text-xs text-foreground outline-none focus:border-brand"
            />
          </form>
          <Link
            href={`/paneladmin/clientes?new=1${catParam}`}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition"
          >
            <span className="text-base leading-none">+</span> Nuevo cliente
          </Link>
        </div>
      </div>

      {/* New/edit form panel */}
      {showNew && (
        <div className="mb-6 rounded-xl border border-line bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">
              {params.edit ? 'Editar cliente' : 'Nuevo cliente'}
            </h2>
            <Link
              href={`/paneladmin/clientes${activeCategory ? `?cat=${activeCategory}` : ''}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition text-lg leading-none"
            >
              ×
            </Link>
          </div>
          <ClientForm editingClient={data.editingClient} locale={locale} />
        </div>
      )}

      {/* Clients table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-6 py-4">{t(locale, 'clients.list.col.client')}</th>
                <th className="px-6 py-4">Categorías</th>
                <th className="px-6 py-4">{t(locale, 'clients.list.col.status')}</th>
                <th className="px-6 py-4">{t(locale, 'clients.list.col.remaining')}</th>
                <th className="px-6 py-4">{t(locale, 'clients.list.col.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.clients.map((client) => {
                const summary = summaryMap.get(client.id)
                const packTypes = data.packsByClient.get(client.id) ?? []
                const hasHours = packTypes.includes('hours')
                const hasCerrado = packTypes.some((t) => t !== 'hours')
                const hasServices = data.clientsWithServices.has(client.id)

                return (
                  <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/paneladmin/clientes/${client.id}`} className="font-semibold text-foreground hover:text-brand hover:underline">
                        {client.name}
                      </Link>
                      <p className="text-xs text-slate-400">{client.company || client.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {hasHours && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">Horas</span>}
                        {hasCerrado && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">Pack</span>}
                        {hasServices && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Servicios</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={client.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}>{client.status}</Badge>
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">{formatDuration(summary?.remaining_minutes ?? 0)}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/paneladmin/clientes/${client.id}`} className="rounded-full bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/20 transition">
                          Ver
                        </Link>
                        <Link href={`/paneladmin/clientes?edit=${client.id}${catParam}`} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition">
                          {t(locale, 'clients.list.edit')}
                        </Link>
                        {client.status === 'active' && (
                          <form action={deactivateClientAction}>
                            <input type="hidden" name="id" value={client.id} />
                            <button className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition">{t(locale, 'clients.list.deactivate')}</button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {data.clients.length === 0 && (
            <p className="px-6 py-10 text-sm text-muted">{t(locale, 'clients.list.empty')}</p>
          )}
        </div>
      </Card>
    </AdminShell>
  )
}
