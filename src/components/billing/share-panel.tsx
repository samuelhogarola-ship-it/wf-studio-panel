'use client'

import { useActionState } from 'react'
import { createBillingShareAction, type BillingShareActionState } from '@/lib/actions/billing-shares'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'

export function SharePanel({ documentId, canShare }: { documentId: string; canShare: boolean }) {
  const [state, action, pending] = useActionState(createBillingShareAction, {} as BillingShareActionState)
  return <section className="rounded-xl border border-line p-5"><h2 className="text-lg font-bold">Enlace privado</h2><p className="mt-1 text-sm text-muted">Acceso a este documento durante 7 días; se cierra al quedar pagado.</p><form action={action} className="mt-4"><input type="hidden" name="document_id" value={documentId} /><Button type="submit" disabled={pending || !canShare}>Crear enlace de 7 días</Button></form><FormMessage error={state.error} success={state.success} />{state.shareUrl ? <div className="mt-3 break-all rounded-lg bg-slate-50 p-3 text-sm"><a className="font-semibold text-brand underline" href={state.shareUrl} target="_blank" rel="noreferrer">{state.shareUrl}</a></div> : null}</section>
}
