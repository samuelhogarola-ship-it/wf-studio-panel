'use client'

import { useMemo, useState } from 'react'
import { useActionState } from 'react'

import { ACTIVITY_TYPES } from '@/lib/activity-types'
import { createActivityAction, type AdminFormState } from '@/lib/actions/admin'
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

type PackOption = {
  id: string
  client_id: string
  name: string
  status: 'active' | 'inactive'
}

const initialState: AdminFormState = {}

export function ActivityForm({ clients, packs }: { clients: ClientOption[]; packs: PackOption[] }) {
  const [state, action, pending] = useActionState(createActivityAction, initialState)
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id ?? '')

  const filteredPacks = useMemo(() => packs.filter((pack) => pack.client_id === selectedClientId), [packs, selectedClientId])

  return (
    <Card className="p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Nueva actividad</p>
        <h2 className="mt-2 text-xl font-bold text-foreground">Registrar consumo de horas</h2>
      </div>
      <form action={action} className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="client_id">Cliente</Label>
          <Select id="client_id" name="client_id" value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)} required>
            <option value="">Selecciona un cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name} · {client.email}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="pack_id">Pack</Label>
          <Select id="pack_id" name="pack_id" required defaultValue="">
            <option value="">Selecciona un pack activo</option>
            {filteredPacks.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="activity_type">Tipo de actividad</Label>
          <Select id="activity_type" name="activity_type" defaultValue="desarrollo">
            {ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="title">Título</Label>
          <Input id="title" name="title" placeholder="Optimización SEO local" required />
        </div>
        <div>
          <Label htmlFor="hours_used">Horas consumidas</Label>
          <Input id="hours_used" name="hours_used" type="number" step="0.5" min="0.5" placeholder="1.5" required />
        </div>
        <div>
          <Label htmlFor="work_date">Fecha</Label>
          <Input id="work_date" name="work_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="description">Descripción</Label>
          <Textarea id="description" name="description" placeholder="Resumen breve del trabajo realizado." />
        </div>
        <label className="md:col-span-2 inline-flex items-center gap-3 rounded-2xl border border-line bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input type="checkbox" name="notify_client" className="h-4 w-4 rounded border-line text-brand focus:ring-brand" />
          Notificar al cliente por email
        </label>
        <div className="md:col-span-2">
          <FormMessage error={state.error} success={state.success} />
        </div>
        <div className="md:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Guardando...' : 'Registrar actividad'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
