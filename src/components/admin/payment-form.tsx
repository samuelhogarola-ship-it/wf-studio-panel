'use client'

import { useActionState } from 'react'
import { createPaymentRequestAction, type PaymentActionState } from '@/lib/actions/payments'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type ClientOption = { id: string; name: string; company: string | null; email: string; status: string }
const initialState: PaymentActionState = {}

export function PaymentForm({ clients }: { clients: ClientOption[] }) {
  const [state, action, pending] = useActionState(createPaymentRequestAction, initialState)
  return (
    <Card className="p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Pagos</p>
      <h2 className="mt-2 text-xl font-bold text-foreground">Nueva solicitud de pago</h2>
      <p className="mt-1 text-sm text-muted">El cliente registrado se resuelve en el servidor; deja el selector vacío para un destinatario externo.</p>
      <form action={action} className="mt-5 grid gap-4">
        <div>
          <Label htmlFor="payment_client_id">Cliente registrado</Label>
          <select id="payment_client_id" name="client_id" className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm">
            <option value="">Destinatario externo</option>
            {clients.filter(client => client.status === 'active').map(client => <option key={client.id} value={client.id}>{client.name} · {client.email}</option>)}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="payment_recipient_name">Nombre externo</Label><Input id="payment_recipient_name" name="recipient_name" placeholder="Nombre o empresa" /></div>
          <div><Label htmlFor="payment_recipient_email">Email externo</Label><Input id="payment_recipient_email" name="recipient_email" type="email" placeholder="facturacion@ejemplo.com" /></div>
        </div>
        <div><Label htmlFor="payment_recipient_company">Empresa</Label><Input id="payment_recipient_company" name="recipient_company" placeholder="Opcional" /></div>
        <div><Label htmlFor="payment_concept">Concepto</Label><Textarea id="payment_concept" name="concept" required /></div>
        <div><Label htmlFor="payment_amount">Importe</Label><Input id="payment_amount" name="amount" type="number" min="0.01" step="0.01" required /></div>
        <FormMessage error={state.error} success={state.success} />
        <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Crear solicitud'}</Button>
      </form>
    </Card>
  )
}
