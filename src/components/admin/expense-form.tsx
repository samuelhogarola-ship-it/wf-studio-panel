'use client'

import { useActionState } from 'react'

import { createExpenseAction, type ExpenseFormState } from '@/lib/actions/expenses'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type ClientOption = { id: string; name: string; status: string }
const initialState: ExpenseFormState = {}

export function ExpenseForm({ clients, defaultClientId }: { clients: ClientOption[]; defaultClientId?: string }) {
  const [state, action, pending] = useActionState(createExpenseAction, initialState)

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <div>
        <Label htmlFor="expense-client">Cliente relacionado</Label>
        <Select id="expense-client" name="client_id" defaultValue={defaultClientId ?? ''}>
          <option value="">Sin cliente</option>
          {clients.map((client) => <option key={client.id} value={client.id} disabled={client.status !== 'active'}>{client.name}</option>)}
        </Select>
      </div>
      <div>
        <Label htmlFor="expense-area">Contabilidad</Label>
        <Select id="expense-area" name="accounting_area" defaultValue="general">
          <option value="general">General</option>
          <option value="classes">Clases</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="expense-supplier">Proveedor</Label>
        <Input id="expense-supplier" name="supplier" required placeholder="Empresa o profesional" />
      </div>
      <div>
        <Label htmlFor="expense-category">Categoría</Label>
        <Select id="expense-category" name="category" defaultValue="other">
          <option value="software">Software</option><option value="services">Servicios</option><option value="taxes">Impuestos</option>
          <option value="travel">Desplazamientos</option><option value="office">Oficina</option><option value="marketing">Marketing</option>
          <option value="classes">Clases</option><option value="other">Otros</option>
        </Select>
      </div>
      <div className="md:col-span-2">
        <Label htmlFor="expense-concept">Concepto</Label>
        <Input id="expense-concept" name="concept" required placeholder="Qué se ha pagado" />
      </div>
      <div>
        <Label htmlFor="expense-amount">Importe (€)</Label>
        <Input id="expense-amount" name="amount" type="number" min="0.01" step="0.01" required />
      </div>
      <div>
        <Label htmlFor="expense-date">Fecha</Label>
        <Input id="expense-date" name="expense_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
      </div>
      <div>
        <Label htmlFor="expense-method">Método</Label>
        <Select id="expense-method" name="payment_method" defaultValue="transfer">
          <option value="transfer">Transferencia</option><option value="card">Tarjeta</option><option value="cash">Efectivo</option>
          <option value="direct_debit">Domiciliación</option><option value="other">Otro</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="expense-status">Estado</Label>
        <Select id="expense-status" name="status" defaultValue="paid">
          <option value="paid">Pagado</option><option value="pending">Pendiente</option>
        </Select>
      </div>
      <div className="md:col-span-2">
        <Label htmlFor="expense-notes">Notas</Label>
        <Textarea id="expense-notes" name="notes" placeholder="Referencia, número de ticket u observaciones" />
      </div>
      <div className="md:col-span-2"><FormMessage error={state.error} success={state.success} /></div>
      <div className="md:col-span-2"><Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Registrar gasto'}</Button></div>
    </form>
  )
}
