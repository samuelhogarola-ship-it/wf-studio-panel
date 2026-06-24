'use client'

import { useActionState } from 'react'
import { sendRequestAction, type MessageFormState } from '@/lib/actions/messages'
import { FormMessage } from '@/components/ui/form-message'

const initial: MessageFormState = {}

const SERVICE_TYPES = [
  'Diseño web', 'Desarrollo web', 'SEO', 'Marketing', 'Hosting', 'Dominio',
  'Mantenimiento', 'Consultoría', 'Otro',
]

export function RequestForm({ type }: { type: 'solicitud_servicio' | 'solicitud_bono' }) {
  const [state, action, pending] = useActionState(sendRequestAction, initial)

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="type" value={type} />

      {type === 'solicitud_servicio' && (
        <div className="grid gap-1.5">
          <label className="text-sm font-semibold text-foreground">Tipo de servicio</label>
          <select
            name="subject"
            required
            className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm text-foreground outline-none focus:border-brand focus:bg-white"
          >
            <option value="">Selecciona un servicio…</option>
            {SERVICE_TYPES.map((s) => (
              <option key={s} value={`Solicitud de servicio: ${s}`}>{s}</option>
            ))}
          </select>
        </div>
      )}

      {type === 'solicitud_bono' && (
        <div className="grid gap-1.5">
          <label className="text-sm font-semibold text-foreground">Horas aproximadas</label>
          <select
            name="subject"
            required
            className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm text-foreground outline-none focus:border-brand focus:bg-white"
          >
            <option value="">Selecciona un pack…</option>
            {['5 horas', '10 horas', '20 horas', '40 horas', 'Personalizado'].map((h) => (
              <option key={h} value={`Solicitud de bono de horas: ${h}`}>{h}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-1.5">
        <label className="text-sm font-semibold text-foreground">Descripción / detalles</label>
        <textarea
          name="body"
          required
          rows={4}
          className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm text-foreground outline-none focus:border-brand focus:bg-white resize-none"
          placeholder="Cuéntanos qué necesitas…"
        />
      </div>

      {(state.error || state.success) && <FormMessage error={state.error} success={state.success} />}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
        >
          {pending ? 'Enviando…' : 'Enviar solicitud'}
        </button>
      </div>
    </form>
  )
}
