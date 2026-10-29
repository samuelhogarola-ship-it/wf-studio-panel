import Link from 'next/link'

type AccessEvent = {
  clientId: string
  clientName: string
  eventType: string
  createdAt: string
}

export function ClientAccessNotifications({ events }: { events: AccessEvent[] }) {
  if (!events.length) return null

  return (
    <section aria-labelledby="client-security-title" className="mb-8 rounded-2xl border border-sky-200 bg-sky-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Seguridad de clientes</p>
      <h2 id="client-security-title" className="mt-1 text-xl font-bold text-sky-950">Cambios recientes de acceso</h2>
      <ul className="mt-4 divide-y divide-sky-200">
        {events.map((event) => (
          <li key={`${event.clientId}-${event.createdAt}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <div>
              <span className="font-semibold text-sky-950">Contraseña cambiada por el cliente</span>
              {' · '}
              <Link className="font-semibold text-sky-700 hover:underline" href={`/paneladmin/clientes/${event.clientId}?view=access`}>
                {event.clientName}
              </Link>
            </div>
            <time className="text-sky-700" dateTime={event.createdAt}>
              {new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.createdAt))}
            </time>
          </li>
        ))}
      </ul>
    </section>
  )
}
