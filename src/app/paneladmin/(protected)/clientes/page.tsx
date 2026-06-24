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
import { formatDate, formatDuration } from '@/lib/utils'

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
  const locale = await getLocale()

  return (
    <AdminShell
      title={t(locale, 'clients.title')}
      description={t(locale, 'clients.description')}
      currentPath="/paneladmin/clientes"
      userEmail={identity.email}
      locale={locale}
    >
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
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <ClientForm editingClient={data.editingClient} locale={locale} />

        <Card className="overflow-hidden">
          <div className="border-b border-line px-6 py-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">{t(locale, 'clients.list.title')}</h2>
                <p className="text-sm text-muted">{t(locale, 'clients.list.description')}</p>
              </div>
              <form className="flex gap-2" action="/paneladmin/clientes">
                <input
                  type="search"
                  name="q"
                  defaultValue={params.q ?? ''}
                  placeholder={t(locale, 'clients.list.searchPlaceholder')}
                  className="min-h-11 rounded-full border border-line bg-white px-4 text-sm text-foreground outline-none focus:border-brand"
                />
                <button className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">{t(locale, 'clients.list.searchBtn')}</button>
              </form>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-6 py-4">{t(locale, 'clients.list.col.client')}</th>
                  <th className="px-6 py-4">{t(locale, 'clients.list.col.status')}</th>
                  <th className="px-6 py-4">{t(locale, 'clients.list.col.remaining')}</th>
                  <th className="px-6 py-4">{t(locale, 'clients.list.col.created')}</th>
                  <th className="px-6 py-4">{t(locale, 'clients.list.col.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.clients.map((client) => {
                  const summary = summaryMap.get(client.id)

                  return (
                    <tr key={client.id}>
                      <td className="px-6 py-4">
                        <Link href={`/paneladmin/clientes/${client.id}`} className="font-semibold text-foreground hover:text-brand hover:underline">
                          {client.name}
                        </Link>
                        <p className="text-slate-500">{client.company || client.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={client.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}>{client.status}</Badge>
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground">{formatDuration(summary?.remaining_minutes ?? 0)}</td>
                      <td className="px-6 py-4 text-slate-500">{formatDate(client.created_at)}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/paneladmin/clientes?edit=${client.id}`} className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
                            {t(locale, 'clients.list.edit')}
                          </Link>
                          {client.status === 'active' ? (
                            <form action={deactivateClientAction}>
                              <input type="hidden" name="id" value={client.id} />
                              <button className="rounded-full bg-rose-50 px-3 py-2 font-semibold text-rose-700">{t(locale, 'clients.list.deactivate')}</button>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {data.clients.length === 0 ? <p className="px-6 py-8 text-sm text-muted">{t(locale, 'clients.list.empty')}</p> : null}
          </div>
        </Card>
      </div>
    </AdminShell>
  )
}
