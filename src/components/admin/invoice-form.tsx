'use client'

import { useActionState } from 'react'

import { createInvoiceAction, type InvoiceFormState } from '@/lib/actions/invoices'
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

const initialState: InvoiceFormState = {}

export function InvoiceForm({ clients }: { clients: ClientOption[] }) {
  const [state, action, pending] = useActionState(createInvoiceAction, initialState)

  return (
    <Card className="p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Nueva factura</p>
        <h2 className="mt-2 text-xl font-bold text-foreground">Emitir factura</h2>
      </div>
      <form action={action} className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="client_id">Cliente</Label>
          <Select id="client_id" name="client_id" required defaultValue="">
            <option value="">Selecciona un cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name} · {client.email}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="amount">Importe (€)</Label>
          <Input id="amount" name="amount" type="number" step="0.01" min="0.01" placeholder="150.00" required />
        </div>
        <div>
          <Label htmlFor="payment_method">Método de pago</Label>
          <Select id="payment_method" name="payment_method" defaultValue="transfer">
            <option value="transfer">Transferencia</option>
            <option value="card">Tarjeta</option>
            <option value="cash">Efectivo</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="issued_at">Fecha de emisión</Label>
          <Input id="issued_at" name="issued_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="concept">Concepto</Label>
          <Textarea id="concept" name="concept" placeholder="Servicios de mantenimiento web — Junio 2026" required />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="notes">Notas internas</Label>
          <Textarea id="notes" name="notes" placeholder="Observaciones internas no visibles al cliente." />
        </div>
        <div className="md:col-span-2">
          <FormMessage error={state.error} success={state.success} />
        </div>
        <div className="md:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Creando...' : 'Crear factura'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
