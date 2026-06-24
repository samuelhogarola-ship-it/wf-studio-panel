'use client'

import { useActionState } from 'react'

import { createInvoiceAction, type InvoiceFormState } from '@/lib/actions/invoices'
import { type Locale, t } from '@/lib/i18n'
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
  status: string
}

const initialState: InvoiceFormState = {}

export function InvoiceForm({ clients, locale }: { clients: ClientOption[]; locale: Locale }) {
  const [state, action, pending] = useActionState(createInvoiceAction, initialState)

  return (
    <Card className="p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{t(locale, 'invoiceForm.eyebrow')}</p>
        <h2 className="mt-2 text-xl font-bold text-foreground">{t(locale, 'invoiceForm.title')}</h2>
      </div>
      <form action={action} className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="client_id">{t(locale, 'invoiceForm.client')}</Label>
          <Select id="client_id" name="client_id" required defaultValue="">
            <option value="">{t(locale, 'invoiceForm.client.placeholder')}</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name} · {client.email}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="amount">{t(locale, 'invoiceForm.amount')}</Label>
          <Input id="amount" name="amount" type="number" step="0.01" min="0.01" placeholder="150.00" required />
        </div>
        <div>
          <Label htmlFor="payment_method">{t(locale, 'invoiceForm.method')}</Label>
          <Select id="payment_method" name="payment_method" defaultValue="transfer">
            <option value="transfer">{t(locale, 'invoiceForm.method.transfer')}</option>
            <option value="card">{t(locale, 'invoiceForm.method.card')}</option>
            <option value="cash">{t(locale, 'invoiceForm.method.cash')}</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="issued_at">{t(locale, 'invoiceForm.issuedAt')}</Label>
          <Input id="issued_at" name="issued_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="concept">{t(locale, 'invoiceForm.concept')}</Label>
          <Textarea id="concept" name="concept" placeholder={t(locale, 'invoiceForm.concept.placeholder')} required />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="notes">{t(locale, 'invoiceForm.notes')}</Label>
          <Textarea id="notes" name="notes" placeholder={t(locale, 'invoiceForm.notes.placeholder')} />
        </div>
        <div className="md:col-span-2">
          <FormMessage error={state.error} success={state.success} />
        </div>
        <div className="md:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? t(locale, 'invoiceForm.submitting') : t(locale, 'invoiceForm.submit')}
          </Button>
        </div>
      </form>
    </Card>
  )
}
