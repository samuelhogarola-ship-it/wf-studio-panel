 'use client'
import { useActionState } from 'react'
import { uploadClientPhoto } from '@/lib/actions/client-resources'
import { SUPPORT_READ_ONLY_MESSAGE } from '@/lib/support/read-only'
export function ResourceForm({ readOnly = false }: { readOnly?: boolean }) {
  const [state, action, pending] = useActionState(uploadClientPhoto, {})
  const field = 'w-full rounded-lg border border-line p-3 text-sm'
  return <form action={action} className="grid gap-3 rounded-xl border border-line bg-white p-5">
    <h2 className="text-lg font-bold">Subir fotografía</h2>
    <label>Título<input className={field} name="title" required maxLength={200} /></label>
    <label>Descripción<textarea className={field} name="body" maxLength={10000} /></label>
    <label>Fotografía (JPG, PNG o WebP, hasta 10 MB)<input className={field} type="file" name="file" accept="image/jpeg,image/png,image/webp" required disabled={readOnly} /></label>
    {readOnly && <p className="text-sm font-semibold text-amber-700">{SUPPORT_READ_ONLY_MESSAGE}</p>}
    <button disabled={pending || readOnly} className="rounded-lg bg-brand px-4 py-3 font-semibold text-white disabled:opacity-50">{pending ? 'Guardando…' : 'Guardar'}</button>
    {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-green-700">{state.success}</p>}
  </form>
}
