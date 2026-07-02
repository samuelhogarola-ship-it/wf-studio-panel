'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useActionState } from 'react'

import { upsertPackAction, type AdminFormState } from '@/lib/actions/admin'
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

type EditingPack = {
  id: string
  client_id: string
  name: string
  pack_type: string
  billing_cycle: string
  paid: boolean
  minutes_total: number
  price: number | null
  invoice_number: string | null
  purchase_date: string
  renewal_date: string | null
  status: string
  notes: string | null
} | null

const initialState: AdminFormState = {}

export function PackForm({ clients, editingPack, locale }: { clients: ClientOption[]; editingPack: EditingPack; locale: Locale }) {
  const [state, action, pending] = useActionState(upsertPackAction, initialState)
  const [packType, setPackType] = useState(editingPack?.pack_type ?? 'hours')

  const showHours = packType === 'hours'
  const showRenewal = ['domain', 'hosting', 'service', 'subscription', 'membership'].includes(packType)
  const showBillingCycle = ['subscription', 'membership', 'hosting', 'domain', 'service'].includes(packType)
  const showPaid = packType !== 'hours' && packType !== 'tasks'

  return (
    <Card className="p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{editingPack ? t(locale, 'packForm.eyebrow.edit') : t(locale, 'packForm.eyebrow.new')}</p>
        <h2 className="mt-2 text-xl font-bold text-foreground">{editingPack ? editingPack.name : t(locale, 'packForm.title.new')}</h2>
      </div>
      <form action={action} className="grid gap-4 md:grid-cols-2">
        <input type="hidden" name="id" value={editingPack?.id ?? ''} />
        <div>
          <Label htmlFor="client_id">{t(locale, 'packForm.client')}</Label>
          <Select id="client_id" name="client_id" defaultValue={editingPack?.client_id ?? ''} required>
            <option value="">{t(locale, 'packForm.client.placeholder')}</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id} disabled={client.status !== 'active'}>
                {client.name} · {client.email}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="pack_type">{t(locale, 'packForm.packType')}</Label>
          <Select
            id="pack_type"
            name="pack_type"
            value={packType}
            onChange={(e) => setPackType(e.target.value as typeof packType)}
          >
            <option value="hours">{t(locale, 'packForm.packType.hours')}</option>
            <option value="tasks">{t(locale, 'packForm.packType.tasks')}</option>
            <option value="domain">{t(locale, 'packForm.packType.domain')}</option>
            <option value="hosting">{t(locale, 'packForm.packType.hosting')}</option>
            <option value="service">{t(locale, 'packForm.packType.service')}</option>
            <option value="subscription">{t(locale, 'packForm.packType.subscription')}</option>
            <option value="membership">{t(locale, 'packForm.packType.membership')}</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="name">{t(locale, 'packForm.name')}</Label>
          <Input id="name" name="name" defaultValue={editingPack?.name ?? ''} placeholder={t(locale, 'packForm.name.placeholder')} required />
        </div>
        {showHours && (
          <div>
            <Label htmlFor="hours_total">{t(locale, 'packForm.hours')}</Label>
            <Input
              id="hours_total"
              name="hours_total"
              type="number"
              step="0.5"
              min="0.5"
              defaultValue={editingPack?.pack_type === 'hours' ? editingPack.minutes_total / 60 : ''}
              placeholder="10"
              required
            />
          </div>
        )}
        <div>
          <Label htmlFor="price">{t(locale, 'packForm.price')}</Label>
          <Input id="price" name="price" type="number" step="0.01" min="0" defaultValue={editingPack?.price ?? ''} />
        </div>
        <div>
          <Label htmlFor="invoice_number">{t(locale, 'packForm.invoice')}</Label>
          <Input id="invoice_number" name="invoice_number" defaultValue={editingPack?.invoice_number ?? ''} />
        </div>
        <div>
          <Label htmlFor="purchase_date">{t(locale, 'packForm.purchaseDate')}</Label>
          <Input id="purchase_date" name="purchase_date" type="date" defaultValue={editingPack?.purchase_date ?? ''} required />
        </div>
        {showRenewal && (
          <div>
            <Label htmlFor="renewal_date">{t(locale, 'packForm.renewalDate')}</Label>
            <Input id="renewal_date" name="renewal_date" type="date" defaultValue={editingPack?.renewal_date ?? ''} />
          </div>
        )}
        {showBillingCycle && (
          <div>
            <Label htmlFor="billing_cycle">{t(locale, 'packForm.billingCycle')}</Label>
            <Select id="billing_cycle" name="billing_cycle" defaultValue={editingPack?.billing_cycle ?? 'one_time'}>
              <option value="one_time">{t(locale, 'packForm.billingCycle.oneTime')}</option>
              <option value="monthly">{t(locale, 'packForm.billingCycle.monthly')}</option>
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="status">{t(locale, 'packForm.status')}</Label>
          <Select id="status" name="status" defaultValue={editingPack?.status ?? 'active'}>
            <option value="active">{t(locale, 'packForm.status.active')}</option>
            <option value="inactive">{t(locale, 'packForm.status.inactive')}</option>
          </Select>
        </div>
        {showPaid && (
          <div>
            <Label htmlFor="paid">{t(locale, 'packForm.paymentStatus')}</Label>
            <Select id="paid" name="paid" defaultValue={editingPack?.paid ? 'true' : 'false'}>
              <option value="false">{t(locale, 'packForm.paymentStatus.pending')}</option>
              <option value="true">{t(locale, 'packForm.paymentStatus.paid')}</option>
            </Select>
          </div>
        )}
        <div className="md:col-span-2">
          <Label htmlFor="notes">{t(locale, 'packForm.notes')}</Label>
          <Textarea id="notes" name="notes" defaultValue={editingPack?.notes ?? ''} placeholder={t(locale, 'packForm.notes.placeholder')} />
        </div>
        <div className="md:col-span-2">
          <FormMessage error={state.error} success={state.success} />
        </div>
        <div className="md:col-span-2 flex flex-wrap gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? t(locale, 'packForm.submitting') : editingPack ? t(locale, 'packForm.submit.edit') : t(locale, 'packForm.submit.new')}
          </Button>
          {editingPack ? (
            <Link href="/paneladmin/bonos" className="inline-flex items-center rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
              {t(locale, 'packForm.cancel')}
            </Link>
          ) : null}
        </div>
      </form>
    </Card>
  )
}
