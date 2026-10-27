'use client'

import { useActionState } from 'react'
import { createBillingShareAction, revokeBillingShareAction, type BillingShareActionState } from '@/lib/actions/billing-shares'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'

export function SharePanel({ documentId, canShare, activeShareId }: { documentId: string; canShare: boolean; activeShareId?: string | null }) {
  const [state, action, pending] = useActionState(createBillingShareAction, {} as BillingShareActionState)
  const shareId = state.shareId ?? activeShareId
  return <section className="rounded-xl border border-line p-5"><h2 className="text-lg font-bold">Enlace privado</h2><p className="mt-1 text-sm text-muted">Acceso a este documento durante 7 días; se cierra al quedar pagado.</p><div className="mt-4 flex flex-wrap gap-3"><form action={action}><input type="hidden" name="document_id" value={documentId} /><Button type="submit" disabled={pending || !canShare}>Crear enlace de 7 días</Button></form>{shareId ? <form action={revokeBillingShareAction}><input type="hidden" name="share_id" value={shareId} /><Button type="submit" variant="danger">Revocar enlace activo</Button></form> : null}</div><FormMessage error={state.error} success={state.success} />{state.shareUrl ? <div className="mt-3 break-all rounded-lg bg-slate-50 p-3 text-sm"><a className="font-semibold text-brand underline" href={state.shareUrl} target="_blank" rel="noreferrer">{state.shareUrl}</a></div> : null}</section>
}
