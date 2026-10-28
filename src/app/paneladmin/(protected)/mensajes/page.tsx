import Link from 'next/link'

import { ClientMessageForm } from '@/components/admin/client-message-form'
import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getAdminMessagesPageData } from '@/lib/data/admin'
import { getLocale } from '@/lib/locale'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>
}) {
  const identity = await requireAdmin()
  const [params, data, locale] = await Promise.all([searchParams, getAdminMessagesPageData(), getLocale()])
  const selectedClient = data.clients.find((client) => client.id === params.client) ?? null
  const messages = selectedClient
    ? data.messages.filter((message) => message.client_id === selectedClient.id)
    : data.messages

  return (
    <AdminShell
      title="Mensajes"
      description="Bandeja del CRM y comunicación con cada cliente."
      currentPath="/paneladmin/mensajes"
      userEmail={identity.email}
      locale={locale}
    >
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        <Link href="/paneladmin/mensajes" className={cn('whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold', !selectedClient ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600')}>Todos</Link>
        {data.clients.map((client) => (
          <Link key={client.id} href={`/paneladmin/mensajes?client=${client.id}`} className={cn('whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold', selectedClient?.id === client.id ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600')}>
            {client.name}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Nuevo mensaje</p>
          {selectedClient ? (
            <>
              <div className="mb-4 mt-2 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{selectedClient.name}</h2>
                  <p className="text-sm text-muted">{selectedClient.email}</p>
                </div>
                <Link href={`/paneladmin/clientes/${selectedClient.id}#mensajes`} className="text-sm font-semibold text-brand">Abrir ficha</Link>
              </div>
              <ClientMessageForm clientId={selectedClient.id} />
            </>
          ) : (
            <p className="mt-3 rounded-2xl border border-dashed border-line p-5 text-sm text-muted">Selecciona un cliente para escribirle.</p>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-line px-6 py-5">
            <h2 className="text-xl font-bold text-foreground">Conversaciones recientes</h2>
            <p className="text-sm text-muted">{selectedClient ? `Mensajes de ${selectedClient.name}` : 'Mensajes de todos los clientes'}</p>
          </div>
          <div className="divide-y divide-line">
            {messages.map((message) => (
              <div key={message.id} className="px-6 py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/paneladmin/clientes/${message.client_id}#mensajes`} className="font-semibold text-foreground hover:text-brand">{message.clients?.name ?? 'Cliente'}</Link>
                  <Badge className={message.direction === 'outbound' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}>
                    {message.direction === 'outbound' ? 'Cliente' : 'Studio'}
                  </Badge>
                  {message.type !== 'message' ? <Badge className="bg-slate-100 text-slate-600">{message.type}</Badge> : null}
                </div>
                <p className="mt-2 font-semibold text-foreground">{message.subject}</p>
                <p className="mt-1 line-clamp-3 text-sm text-slate-600">{message.body}</p>
                <p className="mt-2 text-xs text-slate-400">{formatDate(message.created_at)}</p>
              </div>
            ))}
            {messages.length === 0 ? <p className="px-6 py-10 text-sm text-muted">Todavía no hay mensajes.</p> : null}
          </div>
        </Card>
      </div>
    </AdminShell>
  )
}
