'use client'

import { useActionState } from 'react'

import { provisionOrResetClientAccessAction, type ManagedAccessState } from '@/lib/actions/admin'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'

const initialState: ManagedAccessState = {}

export function ClientAccessManager({ clientId, clientName, accessStatus }: {
  clientId: string
  clientName: string
  accessStatus: { status: 'missing' | 'ready' | 'blocked'; authUserId?: string; reason?: string }
}) {
  const [state, action, pending] = useActionState(provisionOrResetClientAccessAction, initialState)
  const blocked = accessStatus.status === 'blocked'
  const creating = accessStatus.status === 'missing'

  return (
    <Card className="p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Seguridad</p>
      <h2 className="mt-2 text-xl font-bold text-foreground">Acceso de {clientName}</h2>
      <p className="mt-2 text-sm text-muted">
        {blocked ? 'La identidad necesita revisión manual antes de modificar el acceso.' : creating ? 'Este cliente todavía no tiene una cuenta de acceso.' : 'Puedes sustituir su contraseña por una nueva contraseña temporal.'}
      </p>
      <form action={action} className="mt-5">
        <input type="hidden" name="client_id" value={clientId} />
        <Button type="submit" disabled={pending || blocked}>
          {pending ? 'Generando…' : creating ? 'Crear acceso y contraseña' : 'Generar nueva contraseña'}
        </Button>
      </form>
      <div className="mt-4"><FormMessage error={state.error} success={state.success} /></div>
      {state.generatedPassword ? (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-950">Contraseña temporal — visible una sola vez</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input aria-label="Contraseña temporal" value={state.generatedPassword} readOnly />
            <Button type="button" variant="secondary" onClick={() => navigator.clipboard.writeText(state.generatedPassword!)}>Copiar</Button>
          </div>
          <p className="mt-2 text-xs text-amber-800">Cópiala y entrégasela al cliente. Al recargar desaparecerá.</p>
        </div>
      ) : null}
    </Card>
  )
}
