'use client'

import { useActionState } from 'react'

import { sendAdminClientMessageAction, type AdminFormState } from '@/lib/actions/admin'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const initialState: AdminFormState = {}

export function ClientMessageForm({
  clientId,
  replyToId,
  defaultSubject,
}: {
  clientId: string
  replyToId?: string
  defaultSubject?: string
}) {
  const [state, action, pending] = useActionState(sendAdminClientMessageAction, initialState)

  return (
    <form action={action} className="grid gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4">
      <input type="hidden" name="client_id" value={clientId} />
      {replyToId ? <input type="hidden" name="reply_to_id" value={replyToId} /> : null}

      <div>
        <Label htmlFor="client-message-subject">Asunto</Label>
        <Input id="client-message-subject" name="subject" defaultValue={defaultSubject ?? ''} placeholder="Ej.: Necesito estos datos para continuar" required />
      </div>

      <div>
        <Label htmlFor="client-message-body">Mensaje</Label>
        <Textarea id="client-message-body" name="body" placeholder="Escribe el mensaje que verá el cliente en su portal." required />
      </div>

      <FormMessage error={state.error} success={state.success} />

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Enviando…' : 'Enviar mensaje al cliente'}
        </Button>
      </div>
    </form>
  )
}
