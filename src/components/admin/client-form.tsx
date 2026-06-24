'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useActionState } from 'react'

import { upsertClientAction, createClientDirectAction, type AdminFormState } from '@/lib/actions/admin'
import { type Locale, t } from '@/lib/i18n'
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
  status: string
} | null

const initialState: AdminFormState = {}

export function ClientForm({ editingClient, locale }: { editingClient: EditingClient; locale: Locale }) {
  const [state, action, pending] = useActionState(upsertClientAction, initialState)
  const [directState, directAction, directPending] = useActionState(createClientDirectAction, initialState)
  const [showDirect, setShowDirect] = useState(false)

  return (
    <div className="grid gap-4">
      <Card className="p-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{editingClient ? t(locale, 'clientForm.eyebrow.edit') : t(locale, 'clientForm.eyebrow.new')}</p>
          <h2 className="mt-2 text-xl font-bold text-foreground">{editingClient ? editingClient.name : t(locale, 'clientForm.title.new')}</h2>
        </div>
        <form action={action} className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="id" value={editingClient?.id ?? ''} />
          <div>
            <Label htmlFor="name">{t(locale, 'clientForm.name')}</Label>
            <Input id="name" name="name" defaultValue={editingClient?.name ?? ''} required />
          </div>
          <div>
            <Label htmlFor="company">{t(locale, 'clientForm.company')}</Label>
            <Input id="company" name="company" defaultValue={editingClient?.company ?? ''} />
          </div>
          <div>
            <Label htmlFor="email">{t(locale, 'clientForm.email')}</Label>
            <Input id="email" name="email" type="email" defaultValue={editingClient?.email ?? ''} required />
          </div>
          <div>
            <Label htmlFor="phone">{t(locale, 'clientForm.phone')}</Label>
            <Input id="phone" name="phone" defaultValue={editingClient?.phone ?? ''} />
          </div>
          <div>
            <Label htmlFor="status">{t(locale, 'clientForm.status')}</Label>
            <Select id="status" name="status" defaultValue={editingClient?.status ?? 'active'}>
              <option value="active">{t(locale, 'clientForm.status.active')}</option>
              <option value="inactive">{t(locale, 'clientForm.status.inactive')}</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <FormMessage error={state.error} success={state.success} />
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? t(locale, 'clientForm.submitting') : editingClient ? t(locale, 'clientForm.submit.edit') : t(locale, 'clientForm.submit.new')}
            </Button>
            {editingClient ? (
              <Link href="/paneladmin/clientes" className="inline-flex items-center rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
                {t(locale, 'clientForm.cancel')}
              </Link>
            ) : null}
          </div>
        </form>
      </Card>

      {!editingClient && (
        <Card className="p-6">
          <button
            type="button"
            onClick={() => setShowDirect(!showDirect)}
            className="flex w-full items-center justify-between text-left"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Acceso directo</p>
              <p className="mt-1 text-sm font-semibold text-foreground">Crear cliente con contraseña</p>
            </div>
            <span className="text-muted text-lg">{showDirect ? '−' : '+'}</span>
          </button>

          {showDirect && (
            <form action={directAction} className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="direct-name">Nombre</Label>
                <Input id="direct-name" name="name" required />
              </div>
              <div>
                <Label htmlFor="direct-email">Email</Label>
                <Input id="direct-email" name="email" type="email" required />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="direct-password">Contraseña temporal</Label>
                <Input id="direct-password" name="password" type="password" minLength={6} required placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="md:col-span-2">
                <FormMessage error={directState.error} success={directState.success} />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={directPending}>
                  {directPending ? 'Creando...' : 'Crear cliente con contraseña'}
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}
    </div>
  )
}
