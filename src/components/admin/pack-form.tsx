'use client'

import { useActionState } from 'react'

import { upsertPackAction, type AdminFormState } from '@/lib/actions/admin'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type ClientOption = {
  id: string
  name: string
  email: string
  status: 'active' | 'inactive'
}

type EditingPack = {
  id: string
  client_id: string
  name: string
  minutes_total: number
  price: number | null
  invoice_number: string | null
  purchase_date: string
  status: 'active' | 'inactive'
  notes: string | null
} | null

const initialState: AdminFormState = {}

export function PackForm({ clients, editingPack }: { clients: ClientOption[]; editingPack: EditingPack }) {
  const [state, action, pending] = useActionState(upsertPackAction, initialState)

  return (
    <Card className="p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{editingPack ? 'Editar pack' : 'Nuevo pack'}</p>
        <h2 className="mt-2 text-xl font-bold text-foreground">{editingPack ? editingPack.name : 'Registrar nuevo bono'}</h2>
      </div>
      <form action={action} className="grid gap-4 md:grid-cols-2">
        <input type="hidden" name="id" value={editingPack?.id ?? ''} />
        <div>
          <Label htmlFor="client_id">Cliente</Label>
          <Select id="client_id" name="client_id" defaultValue={editingPack?.client_id ?? ''} required>
            <option value="">Selecciona un cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id} disabled={client.status !== 'active'}>
                {client.name} · {client.email}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="name">Nombre del pack</Label>
          <Input id="name" name="name" defaultValue={editingPack?.name ?? ''} placeholder="Pack 600 min / Horas sueltas" required />
        </div>
        <div>
          <Label htmlFor="minutes_total">Minutos totales</Label>
          <Input id="minutes_total" name="minutes_total" type="number" step="1" min="1" defaultValue={editingPack?.minutes_total ?? ''} required />
        </div>
        <div>
          <Label htmlFor="price">Precio</Label>
          <Input id="price" name="price" type="number" step="0.01" min="0" defaultValue={editingPack?.price ?? ''} />
        </div>
        <div>
          <Label htmlFor="invoice_number">Factura</Label>
          <Input id="invoice_number" name="invoice_number" defaultValue={editingPack?.invoice_number ?? ''} />
        </div>
        <div>
          <Label htmlFor="purchase_date">Fecha de compra</Label>
          <Input id="purchase_date" name="purchase_date" type="date" defaultValue={editingPack?.purchase_date ?? ''} required />
        </div>
        <div>
          <Label htmlFor="status">Estado</Label>
          <Select id="status" name="status" defaultValue={editingPack?.status ?? 'active'}>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="notes">Notas</Label>
          <Textarea id="notes" name="notes" defaultValue={editingPack?.notes ?? ''} placeholder="Detalles internos, contexto o condiciones del pack." />
        </div>
        <div className="md:col-span-2">
          <FormMessage error={state.error} success={state.success} />
        </div>
        <div className="md:col-span-2 flex flex-wrap gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? 'Guardando...' : editingPack ? 'Guardar cambios' : 'Crear pack'}
          </Button>
          {editingPack ? (
            <a href="/paneladmin/bonos" className="inline-flex items-center rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
              Cancelar edición
            </a>
          ) : null}
        </div>
      </form>
    </Card>
  )
}
