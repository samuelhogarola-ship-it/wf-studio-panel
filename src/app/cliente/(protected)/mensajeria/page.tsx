import { requireClientAccess } from '@/lib/auth'
import { getClientMessages, getClientPendingItems, markClientInboundMessagesRead } from '@/lib/data/client'
import { MessageComposer } from '@/components/client/message-composer'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type Tab = 'recibidos' | 'enviados' | 'recordatorios'

export default async function MensajeriaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; reply?: string; new?: string; pending?: string }>
}) {
  const identity = await requireClientAccess()
  const params = await searchParams
  const tab = (params.tab ?? 'recibidos') as Tab
  const [messages, pendingItems] = await Promise.all([
    getClientMessages(identity.client.id),
    params.pending ? getClientPendingItems(identity.client.id) : Promise.resolve([]),
  ])

  const recibidos = messages.filter((m) => m.direction === 'inbound' && m.type === 'message')
  const readAt = tab === 'recibidos'
    ? await markClientInboundMessagesRead(identity.client.id, recibidos.filter((m) => !m.read_at).map((m) => m.id))
    : null
  const recibidosActualizados = readAt ? recibidos.map((m) => (m.read_at ? m : { ...m, read_at: readAt })) : recibidos
  const enviados = messages.filter((m) => m.direction === 'outbound')
  const recordatorios = messages.filter((m) => m.type === 'reminder')

  const current = tab === 'enviados' ? enviados : tab === 'recordatorios' ? recordatorios : recibidosActualizados
  const unread = recibidosActualizados.filter((m) => !m.read_at).length
  const replyTo = params.reply ? messages.find((m) => m.id === params.reply) : null
  const pendingItem = params.pending ? pendingItems.find((item) => item.id === params.pending) : null
  const showCompose = params.new === '1' || !!replyTo
  const defaultSubject = replyTo ? `Re: ${replyTo.subject}` : pendingItem ? `Pendiente: ${pendingItem.title}` : ''
  const defaultBody = pendingItem
    ? `Hola, os envío el dato pendiente: ${pendingItem.title}\n\n`
    : ''

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'recibidos', label: 'Recibidos', count: unread || undefined },
    { key: 'enviados', label: 'Enviados' },
    { key: 'recordatorios', label: 'Recordatorios' },
  ]

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-black tracking-tight text-foreground">Mensajería</h1>
        <a
          href="/cliente/mensajeria?new=1"
          className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
        >
          <span className="text-base leading-none">+</span> Nuevo mensaje
        </a>
      </div>

      <div className="mb-5 flex gap-1.5">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={`/cliente/mensajeria?tab=${t.key}`}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              tab === t.key ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.label}
            {t.count ? <span className="rounded-full bg-white/30 px-1.5 text-xs font-bold">{t.count}</span> : null}
          </a>
        ))}
      </div>

      {showCompose && (
        <div className="mb-6 rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-foreground">
              {replyTo ? `Re: ${replyTo.subject}` : 'Nuevo mensaje'}
            </h2>
            <a
              href={`/cliente/mensajeria?tab=${tab}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 text-lg leading-none"
            >
              ×
            </a>
          </div>
          {replyTo && (
            <div className="mb-4 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-500">
              <p className="font-semibold text-slate-600 mb-1">{replyTo.subject}</p>
              <p className="line-clamp-2">{replyTo.body}</p>
            </div>
          )}
          {pendingItem && (
            <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold">Respondiendo pendiente: {pendingItem.title}</p>
              {pendingItem.description ? <p className="mt-1 text-amber-700">{pendingItem.description}</p> : null}
            </div>
          )}
          <MessageComposer replyToId={replyTo?.id} defaultSubject={defaultSubject} defaultBody={defaultBody} />
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {current.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-400">
            {tab === 'recibidos' && 'No tienes mensajes recibidos.'}
            {tab === 'enviados' && 'No has enviado ningún mensaje todavía.'}
            {tab === 'recordatorios' && 'No hay recordatorios.'}
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {current.map((msg) => (
              <div key={msg.id} className={`px-6 py-4 ${!msg.read_at && msg.direction === 'inbound' ? 'bg-brand/5' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {!msg.read_at && msg.direction === 'inbound' && (
                        <span className="h-2 w-2 rounded-full bg-brand shrink-0" />
                      )}
                      <p className={`font-semibold truncate ${!msg.read_at && msg.direction === 'inbound' ? 'text-brand' : 'text-foreground'}`}>
                        {msg.subject}
                      </p>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2 mt-0.5">{msg.body}</p>
                  </div>
                  <div className="shrink-0 text-right flex flex-col items-end gap-2">
                    <p className="text-xs text-slate-400 whitespace-nowrap">{formatDate(msg.created_at)}</p>
                    {msg.direction === 'inbound' && (
                      <a
                        href={`/cliente/mensajeria?tab=recibidos&reply=${msg.id}`}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
                      >
                        Responder
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
