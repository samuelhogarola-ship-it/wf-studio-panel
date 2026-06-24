'use client'

import { useActionState } from 'react'

import { ACTIVITY_TYPES } from '@/lib/activity-types'
import { createActivityAction, type AdminFormState } from '@/lib/actions/admin'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const initialState: AdminFormState = {}

export function PackActivityForm({
  packId,
  clientId,
  isHoursPack,
}: {
  packId: string
  clientId: string
  isHoursPack: boolean
}) {
  const [state, action, pending] = useActionState(createActivityAction, initialState)

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="pack_id" value={packId} />
      <input type="hidden" name="client_id" value={clientId} />

      <div>
        <Label htmlFor="pa-title">Título</Label>
        <Input id="pa-title" name="title" placeholder="Descripción breve de lo realizado" required />
      </div>

      <div>
        <Label htmlFor="pa-type">Categoría</Label>
        <Select id="pa-type" name="activity_type" defaultValue="desarrollo">
          {ACTIVITY_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </Select>
      </div>

      {isHoursPack && (
        <div>
          <Label htmlFor="pa-hours">Horas</Label>
          <Input
            id="pa-hours"
            name="hours_used"
            type="number"
            step="0.5"
            min="0.5"
            placeholder="1.5"
            required
          />
        </div>
      )}

      <div>
        <Label htmlFor="pa-date">Fecha</Label>
        <Input
          id="pa-date"
          name="work_date"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
        />
      </div>

      <div className="md:col-span-2">
        <Label htmlFor="pa-description">Detalle</Label>
        <Textarea id="pa-description" name="description" placeholder="Qué se hizo exactamente, contexto, enlaces..." />
      </div>

      <label className="md:col-span-2 inline-flex items-center gap-3 rounded-2xl border border-line bg-slate-50 px-4 py-3 text-sm text-slate-700 cursor-pointer">
        <input type="checkbox" name="notify_client" className="h-4 w-4 rounded border-line text-brand" />
        Notificar al cliente por email
      </label>

      <div className="md:col-span-2">
        <FormMessage error={state.error} success={state.success} />
      </div>

      <div className="md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar registro'}
        </Button>
      </div>
    </form>
  )
}
