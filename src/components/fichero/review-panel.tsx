'use client'

import { useActionState } from 'react'

import { reviewDirectoryProfileAction } from '@/lib/actions/fichero-admin'
import type { DirectoryAdminChannel } from '@/lib/fichero/admin'

const labels = { 'vivir-fuengirola': 'Vivir en Fuengirola', 'conoce-fuengirola': 'Conoce Fuengirola' }

function State({ state }: { state: { error?: string; success?: string } }) { return state.error || state.success ? <p role={state.error ? 'alert' : 'status'} className="mt-3 text-sm">{state.error ?? state.success}</p> : null }

export function ReviewPanel({ profileId, catalogKey = 'fuengirola', channels }: { profileId: string; catalogKey?: string; channels: DirectoryAdminChannel[] }) {
  const [approveState, approveAction, approvePending] = useActionState(reviewDirectoryProfileAction, {})
  const [publishState, publishAction, publishPending] = useActionState(reviewDirectoryProfileAction, {})
  const [rejectState, rejectAction, rejectPending] = useActionState(reviewDirectoryProfileAction, {})
  const enabled = channels.filter(channel => channel.enabled)
  const hidden = <><input type="hidden" name="profileId" value={profileId} /><input type="hidden" name="catalogKey" value={catalogKey} /></>
  return <section className="mt-6 grid gap-4 lg:grid-cols-3">
    <form action={approveAction} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">{hidden}<input type="hidden" name="decision" value="approve" /><h2 className="font-black text-emerald-950">Aprobar sin publicar</h2><p className="mt-2 text-sm">Valida el contenido, pero mantiene los destinos sin cambios.</p><button disabled={approvePending} className="mt-4 rounded-full bg-emerald-700 px-5 py-2 font-bold text-white">Aprobar</button><State state={approveState} /></form>
    <form action={publishAction} className="rounded-2xl border border-blue-200 bg-blue-50 p-5">{hidden}<input type="hidden" name="decision" value="approve_publish" /><h2 className="font-black text-blue-950">Aprobar y publicar</h2><p className="mt-2 text-sm">Destinos: {enabled.map(channel => labels[channel.channelKey]).join(' · ') || 'ninguno'}</p><label className="mt-3 flex items-start gap-2 text-sm font-semibold"><input type="checkbox" name="confirm_publish" required />Confirmo la publicación en los canales indicados.</label><button disabled={publishPending} className="mt-4 rounded-full bg-blue-700 px-5 py-2 font-bold text-white">Aprobar y publicar</button><State state={publishState} /></form>
    <form action={rejectAction} className="rounded-2xl border border-rose-200 bg-rose-50 p-5">{hidden}<input type="hidden" name="decision" value="reject" /><h2 className="font-black text-rose-950">Rechazar</h2><label className="mt-3 block text-sm font-semibold">Nota obligatoria<textarea name="note" required maxLength={1000} className="mt-2 min-h-24 w-full rounded-xl border border-rose-200 p-3 font-normal" /></label><button disabled={rejectPending} className="mt-4 rounded-full bg-rose-700 px-5 py-2 font-bold text-white">Rechazar ficha</button><State state={rejectState} /></form>
  </section>
}
