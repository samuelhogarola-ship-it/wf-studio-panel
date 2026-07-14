'use client'

import { useState } from 'react'
import { useActionState } from 'react'

import { createPendingItemAction, type AdminFormState } from '@/lib/actions/admin'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const initialState: AdminFormState = {}

export function PendingItemForm({ clientId }: { clientId: string }) {
  const [state, action, pending] = useActionState(createPendingItemAction, initialState)
  const [frequency, setFrequency] = useState<'none' | 'daily' | 'custom'>('none')

  return (
    <form action={action} className="grid gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4">
      <input type="hidden" name="client_id" value={clientId} />
      <div>
        <Label htmlFor="pending-title">Dato o tarea pendiente</Label>
        <Input id="pending-title" name="title" placeholder="Ej.: Falta acceso a Google Business Profile" required />
      </div>
      <div>
        <Label htmlFor="pending-description">Contexto</Label>
        <Textarea
          id="pending-description"
          name="description"
          placeholder="Qué falta exactamente, dónde lo puede enviar o cualquier aclaración útil."
        />
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_180px]">
        <div>
          <Label htmlFor="pending-frequency">Recordatorio por email</Label>
          <select
            id="pending-frequency"
            name="reminder_frequency"
            value={frequency}
            onChange={(event) => setFrequency(event.target.value as 'none' | 'daily' | 'custom')}
            className="mt-2 flex h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-brand"
          >
            <option value="none">Sin recordatorio recurrente</option>
            <option value="daily">Cada día</option>
            <option value="custom">Cada X días</option>
          </select>
          <p className="mt-2 text-xs text-slate-500">Al crear el pendiente se envía siempre un email inicial al cliente.</p>
        </div>
        <div>
          <Label htmlFor="pending-interval">Cada cuántos días</Label>
          <Input
            id="pending-interval"
            name="reminder_interval_days"
            type="number"
            min="1"
            step="1"
            defaultValue="2"
            disabled={frequency !== 'custom'}
          />
        </div>
      </div>
      <FormMessage error={state.error} success={state.success} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Añadir pendiente'}
        </Button>
      </div>
    </form>
  )
}
