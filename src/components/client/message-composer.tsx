'use client'

import { useActionState } from 'react'
import { sendMessageAction, type MessageFormState } from '@/lib/actions/messages'
import { FormMessage } from '@/components/ui/form-message'
import { SUPPORT_READ_ONLY_MESSAGE } from '@/lib/support/read-only'

const initial: MessageFormState = {}

export function MessageComposer({
  replyToId,
  defaultSubject,
  defaultBody,
  readOnly = false,
}: {
  replyToId?: string
  defaultSubject?: string
  defaultBody?: string
  readOnly?: boolean
}) {
  const [state, action, pending] = useActionState(sendMessageAction, initial)

  return (
    <form action={action} className="grid gap-4">
      {replyToId && <input type="hidden" name="reply_to_id" value={replyToId} />}
      <div className="grid gap-1.5">
        <label htmlFor="message-subject" className="text-sm font-semibold text-foreground">Asunto</label>
        <input
          id="message-subject"
          name="subject"
          defaultValue={defaultSubject}
          required
          className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm text-foreground outline-none focus:border-brand focus:bg-white"
          placeholder="Asunto del mensaje"
        />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="message-body" className="text-sm font-semibold text-foreground">Mensaje</label>
        <textarea
          id="message-body"
          name="body"
          required
          rows={5}
          defaultValue={defaultBody}
          className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm text-foreground outline-none focus:border-brand focus:bg-white resize-none"
          placeholder="Escribe tu mensaje aquí..."
        />
      </div>
      {(state.error || state.success) && <FormMessage error={state.error} success={state.success} />}
      {readOnly && <p className="text-sm font-semibold text-amber-700">{SUPPORT_READ_ONLY_MESSAGE}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || readOnly}
          className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
        >
          {pending ? 'Enviando...' : 'Enviar mensaje'}
        </button>
      </div>
    </form>
  )
}
