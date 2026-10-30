'use client'

import { useActionState } from 'react'

import { retryDirectoryProfileChannelAction } from '@/lib/actions/fichero-admin'
import type { DirectoryAdminEvent } from '@/lib/fichero/admin'

const labels = { 'vivir-fuengirola': 'Vivir en Fuengirola', 'conoce-fuengirola': 'Conoce Fuengirola' }
const statuses = { pending: 'Pendiente', publishing: 'Publicando', published: 'Publicado', failed: 'Falló' }

function Retry({ profileId, catalogKey, event }: { profileId: string; catalogKey: string; event: DirectoryAdminEvent }) {
  const [state, action, pending] = useActionState(retryDirectoryProfileChannelAction, {})
  if (event.status !== 'failed') return null
  return <form action={action} className="mt-3"><input type="hidden" name="profileId" value={profileId} /><input type="hidden" name="catalogKey" value={catalogKey} /><input type="hidden" name="channel_key" value={event.channelKey} /><input type="hidden" name="source_version" value={event.sourceVersion} /><button disabled={pending} className="rounded-full border border-rose-300 px-4 py-2 text-sm font-bold">Reintentar solo este canal</button>{state.error || state.success ? <p role={state.error ? 'alert' : 'status'} className="mt-2 text-sm">{state.error ?? state.success}</p> : null}</form>
}

export function PublicationStatus({ profileId, catalogKey = 'fuengirola', events }: { profileId: string; catalogKey?: string; events: DirectoryAdminEvent[] }) {
  return <section className="mt-6 rounded-2xl border border-line bg-white p-6"><h2 className="text-lg font-black">Publicaciones por canal</h2><div className="mt-4 grid gap-3">{events.map(event => <article key={event.eventId} className="rounded-xl bg-slate-50 p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-bold">{labels[event.channelKey]}</p><p className="text-sm">Versión {event.sourceVersion} · {statuses[event.status]}</p></div><p className="mt-1 text-xs text-muted">Evento <code>{event.eventId}</code></p>{event.errorMessage ? <p className="mt-2 text-sm text-rose-800">{event.errorMessage}</p> : null}<Retry profileId={profileId} catalogKey={catalogKey} event={event} /></article>)}{events.length === 0 ? <p className="text-sm text-muted">Aún no hay intentos de publicación.</p> : null}</div></section>
}
