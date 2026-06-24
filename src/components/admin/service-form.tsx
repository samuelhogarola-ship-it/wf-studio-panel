'use client'

import { useActionState } from 'react'

import { upsertServiceAction, type AdminFormState } from '@/lib/actions/admin'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const SERVICE_TYPES = [
  { value: 'bono_horas', label: 'Bono de horas' },
  { value: 'pack_cerrado', label: 'Pack cerrado' },
  { value: 'diseño', label: 'Diseño' },
  { value: 'desarrollo', label: 'Desarrollo web' },
  { value: 'seo', label: 'SEO' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'dominio', label: 'Dominio' },
  { value: 'hosting', label: 'Hosting' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'consultoria', label: 'Consultoría' },
  { value: 'otro', label: 'Otro' },
]

type ClientOption = { id: string; name: string; status: string }

type EditingService = {
  id: string
  client_id: string
  pack_id: string | null
  name: string
  service_type: string
  price: number | null
  service_date: string
  status: string
  notes: string | null
} | null

const initialState: AdminFormState = {}

export function ServiceForm({ clients, editingService }: { clients: ClientOption[]; editingService: EditingService }) {
  const [state, action, pending] = useActionState(upsertServiceAction, initialState)

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      {editingService && <input type="hidden" name="id" value={editingService.id} />}

      <div>
        <Label htmlFor="sf-client">Cliente</Label>
        <Select id="sf-client" name="client_id" defaultValue={editingService?.client_id ?? ''} required>
          <option value="">Selecciona un cliente</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id} disabled={c.status !== 'active'}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="sf-type">Tipo de servicio</Label>
        <Select id="sf-type" name="service_type" defaultValue={editingService?.service_type ?? 'otro'}>
          {SERVICE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </Select>
      </div>

      <div className="md:col-span-2">
        <Label htmlFor="sf-name">Nombre / descripción</Label>
        <Input id="sf-name" name="name" defaultValue={editingService?.name ?? ''} placeholder="Diseño landing page, Pack 10 horas..." required />
      </div>

      <div>
        <Label htmlFor="sf-price">Precio (€)</Label>
        <Input id="sf-price" name="price" type="number" step="0.01" min="0" defaultValue={editingService?.price ?? ''} placeholder="600" />
      </div>

      <div>
        <Label htmlFor="sf-date">Fecha</Label>
        <Input id="sf-date" name="service_date" type="date" defaultValue={editingService?.service_date ?? new Date().toISOString().slice(0, 10)} required />
      </div>

      <div>
        <Label htmlFor="sf-status">Estado</Label>
        <Select id="sf-status" name="status" defaultValue={editingService?.status ?? 'active'}>
          <option value="active">Activo</option>
          <option value="completed">Completado</option>
          <option value="cancelled">Cancelado</option>
        </Select>
      </div>

      <div className="md:col-span-2">
        <Label htmlFor="sf-notes">Notas</Label>
        <Textarea id="sf-notes" name="notes" defaultValue={editingService?.notes ?? ''} placeholder="Detalles, condiciones, entregables..." />
      </div>

      <div className="md:col-span-2">
        <FormMessage error={state.error} success={state.success} />
      </div>

      <div className="md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : editingService ? 'Guardar cambios' : 'Registrar servicio'}
        </Button>
      </div>
    </form>
  )
}
