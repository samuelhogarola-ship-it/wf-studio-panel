'use client'

import { useActionState } from 'react'

import { upsertClientAction, type AdminFormState } from '@/lib/actions/admin'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

type EditingClient = {
  id: string
  name: string
  company: string | null
  email: string
  phone: string | null
  status: 'active' | 'inactive'
} | null

const initialState: AdminFormState = {}

export function ClientForm({ editingClient }: { editingClient: EditingClient }) {
  const [state, action, pending] = useActionState(upsertClientAction, initialState)

  return (
    <Card className="p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{editingClient ? 'Editar cliente' : 'Nuevo cliente'}</p>
        <h2 className="mt-2 text-xl font-bold text-foreground">{editingClient ? editingClient.name : 'Alta rápida de cliente'}</h2>
      </div>
      <form action={action} className="grid gap-4 md:grid-cols-2">
        <input type="hidden" name="id" value={editingClient?.id ?? ''} />
        <div>
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" defaultValue={editingClient?.name ?? ''} required />
        </div>
        <div>
          <Label htmlFor="company">Empresa</Label>
          <Input id="company" name="company" defaultValue={editingClient?.company ?? ''} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={editingClient?.email ?? ''} required />
        </div>
        <div>
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" name="phone" defaultValue={editingClient?.phone ?? ''} />
        </div>
        <div>
          <Label htmlFor="status">Estado</Label>
          <Select id="status" name="status" defaultValue={editingClient?.status ?? 'active'}>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </Select>
        </div>
        <div className="md:col-span-2">
          <FormMessage error={state.error} success={state.success} />
        </div>
        <div className="md:col-span-2 flex flex-wrap gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? 'Guardando...' : editingClient ? 'Guardar cambios' : 'Crear cliente'}
          </Button>
          {editingClient ? (
            <a href="/paneladmin/clientes" className="inline-flex items-center rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
              Cancelar edición
            </a>
          ) : null}
        </div>
      </form>
    </Card>
  )
}
