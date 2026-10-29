'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { upsertClientAction, createClientDirectAction, type AdminFormState, type ManagedAccessState } from '@/lib/actions/admin'
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
const initialAccessState: ManagedAccessState = {}

export function ClientForm({ editingClient, locale, project = 'wf-studio' }: { editingClient: EditingClient; locale: Locale; project?: string }) {
  const [editState, editAction, editPending] = useActionState(upsertClientAction, initialState)
  const [createState, createAction, createPending] = useActionState(createClientDirectAction, initialAccessState)
  const state = editingClient ? editState : createState
  const action = editingClient ? editAction : createAction
  const pending = editingClient ? editPending : createPending

  return (
    <div className="grid gap-4">
      <Card className="p-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{editingClient ? t(locale, 'clientForm.eyebrow.edit') : t(locale, 'clientForm.eyebrow.new')}</p>
          <h2 className="mt-2 text-xl font-bold text-foreground">{editingClient ? editingClient.name : t(locale, 'clientForm.title.new')}</h2>
          {!editingClient ? <p className="mt-2 text-sm text-muted">Al crear el cliente se generará automáticamente su acceso inicial.</p> : null}
        </div>
        <form action={action} className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="id" value={editingClient?.id ?? ''} />
          <input type="hidden" name="project" value={project} />
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
          {!editingClient && createState.generatedPassword ? (
            <div className="md:col-span-2 rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-950">Contraseña inicial — se muestra una sola vez</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input aria-label="Contraseña inicial" value={createState.generatedPassword} readOnly />
                <Button type="button" variant="secondary" onClick={() => navigator.clipboard.writeText(createState.generatedPassword!)}>Copiar</Button>
              </div>
              <p className="mt-2 text-xs text-amber-800">Cópiala ahora. Al recargar esta página dejará de estar disponible.</p>
            </div>
          ) : null}
          <div className="md:col-span-2 flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? t(locale, 'clientForm.submitting') : editingClient ? t(locale, 'clientForm.submit.edit') : t(locale, 'clientForm.submit.new')}
            </Button>
            {editingClient ? (
              <Link href="/paneladmin/clientes" className="inline-flex items-center rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">{t(locale, 'clientForm.cancel')}</Link>
            ) : null}
          </div>
        </form>
      </Card>
    </div>
  )
}
