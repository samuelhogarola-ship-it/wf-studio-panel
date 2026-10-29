import Link from 'next/link'

export const CLIENT_DETAIL_VIEWS = ['summary', 'profile', 'access', 'hours', 'domains', 'hosting', 'services', 'invoices', 'expenses', 'messages', 'history'] as const
export type ClientDetailView = typeof CLIENT_DETAIL_VIEWS[number]

export function normalizeClientDetailView(value?: string): ClientDetailView {
  return CLIENT_DETAIL_VIEWS.includes(value as ClientDetailView) ? value as ClientDetailView : 'summary'
}

const LABELS: Record<ClientDetailView, string> = {
  summary: 'Resumen', profile: 'Ficha', access: 'Acceso', hours: 'Bonos', domains: 'Dominios',
  hosting: 'Hosting', services: 'Servicios', invoices: 'Facturas', expenses: 'Gastos',
  messages: 'Mensajes', history: 'Historial',
}

export function ClientDetailNavigation({ clientId, activeView, counts = {} }: {
  clientId: string
  activeView: ClientDetailView
  counts?: Partial<Record<ClientDetailView, number>>
}) {
  return (
    <nav aria-label="Secciones del cliente" className="rounded-2xl border border-line bg-white p-3 lg:sticky lg:top-6">
      {activeView !== 'summary' ? (
        <Link href={`/paneladmin/clientes/${clientId}?view=summary`} className="mb-2 block rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white lg:hidden">← Volver al resumen</Link>
      ) : null}
      <div className="flex gap-2 overflow-x-auto lg:grid">
        {CLIENT_DETAIL_VIEWS.map((view) => {
          const selected = view === activeView
          const href = `/paneladmin/clientes/${clientId}?view=${selected && view !== 'summary' ? 'summary' : view}`
          return (
            <Link key={view} href={href} aria-current={selected ? 'page' : undefined} className={`flex min-w-max items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-semibold ${selected ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              <span>{LABELS[view]}</span>
              {counts[view] !== undefined ? <span className={selected ? 'text-white/75' : 'text-slate-400'}>{counts[view]}</span> : null}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
