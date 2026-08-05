'use client'

import { useActionState } from 'react'

import { sendPackStartedEmailAction, type AdminFormState } from '@/lib/actions/admin'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'

const initialState: AdminFormState = {}

export function PackTransitionEmailForm({ packId }: { packId: string }) {
  const [state, action, pending] = useActionState(sendPackStartedEmailAction, initialState)

  return (
    <form action={action} className="mt-4 border-t border-line pt-4">
      <input type="hidden" name="pack_id" value={packId} />
      <p className="text-sm text-slate-500">
        Avisa al cliente de que los bonos anteriores se han completado y este bono ya está activo.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} variant="secondary">
          {pending ? 'Enviando…' : 'Enviar aviso de inicio'}
        </Button>
        <FormMessage error={state.error} success={state.success} />
      </div>
    </form>
  )
}
