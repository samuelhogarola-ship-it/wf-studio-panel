'use client'

import { useActionState } from 'react'

import { createBillingAccountAction, type BillingAccountFormState } from '@/lib/actions/billing-accounts'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

const initialState: BillingAccountFormState = {}

export function BillingAccountForm() {
  const [state, action, pending] = useActionState(createBillingAccountAction, initialState)
  return <form action={action} className="grid gap-4 md:grid-cols-3">
    <div><Label htmlFor="account-name">Nombre</Label><Input id="account-name" name="name" required placeholder="Banco principal, Stripe…" /></div>
    <div><Label htmlFor="account-type">Tipo</Label><Select id="account-type" name="account_type" defaultValue="bank"><option value="bank">Cuenta bancaria</option><option value="stripe">Stripe</option><option value="cash">Efectivo</option><option value="other">Otra</option></Select></div>
    <div><Label htmlFor="account-details">Referencia</Label><Input id="account-details" name="details" placeholder="IBAN enmascarado, titular o nota" /></div>
    <div className="md:col-span-2"><FormMessage error={state.error} success={state.success} /></div>
    <div className="flex items-end justify-end"><Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Añadir cuenta'}</Button></div>
  </form>
}
