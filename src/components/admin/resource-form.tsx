'use client'
import { useActionState, useState } from 'react'
import { publishResource } from '@/lib/actions/resources'

export function AdminResourceForm({ clientId }: { clientId: string }) {
  const [state, action, pending] = useActionState(publishResource, {})
  const [kind, setKind] = useState('update')
  const field = 'w-full rounded-lg border border-line p-3 text-sm'
  return <form action={action} className="grid gap-3 rounded-xl border border-line bg-white p-5">
    <h2 className="text-lg font-bold">Añadir al panel del cliente</h2>
    <input type="hidden" name="clientId" value={clientId} />
    <label>Contenido<select className={field} name="kind" value={kind} onChange={event => setKind(event.target.value)}><option value="update">Actualización</option><option value="report">Informe</option><option value="photo">Fotografía</option></select></label>
    <label>Título<input className={field} name="title" required maxLength={200} /></label>
    <label>Descripción<textarea className={field} name="body" maxLength={10000} /></label>
    {kind === 'report' && <label>Ruta del informe<input className={field} name="reportPath" placeholder="/informes/nombre-del-informe" required /></label>}
    {kind === 'photo' && <label>Fotografía (JPG, PNG o WebP, hasta 10 MB)<input className={field} type="file" name="file" accept="image/jpeg,image/png,image/webp" required /></label>}
    <button disabled={pending} className="rounded-lg bg-brand px-4 py-3 font-semibold text-white disabled:opacity-50">{pending ? 'Guardando…' : 'Guardar'}</button>
    {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-green-700">{state.success}</p>}
  </form>
}
