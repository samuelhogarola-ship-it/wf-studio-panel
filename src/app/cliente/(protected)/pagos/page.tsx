import { requireClientCapability } from '@/lib/projects/client-access'
import { getClientPaymentLinks, getClientPaymentRequests } from '@/lib/data/payments'

export const dynamic = 'force-dynamic'

export default async function ClientPaymentsPage() {
  await requireClientCapability('invoices')
  const [requests, links] = await Promise.all([getClientPaymentRequests(), getClientPaymentLinks()])
  return (
    <>
      <div className="mb-6"><h1 className="text-2xl font-black tracking-tight text-foreground">Pagos</h1><p className="mt-0.5 text-sm text-slate-500">Solicitudes pendientes y enlaces de pago seguros.</p></div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold text-foreground">Solicitudes</h2><div className="mt-4 divide-y divide-slate-100">
          {requests.map(request => <div key={request.id} className="flex items-center justify-between gap-4 py-4"><div><p className="font-semibold">{request.concept}</p><p className="text-sm text-slate-500">{request.status === 'paid' ? 'Pagado' : request.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}</p></div><p className="font-bold">{Number(request.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p></div>)}
          {requests.length === 0 ? <p className="py-6 text-sm text-slate-500">No hay solicitudes pendientes.</p> : null}
        </div></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold text-foreground">Enlaces de pago</h2><div className="mt-4 divide-y divide-slate-100">
          {links.map(link => <div key={link.id} className="flex items-center justify-between gap-4 py-4"><div><p className="font-semibold">Stripe</p><p className="text-xs text-slate-500">Enlace asociado a tu cuenta</p></div><a href={link.url} target="_blank" rel="noreferrer" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white">Pagar</a></div>)}
          {links.length === 0 ? <p className="py-6 text-sm text-slate-500">No hay enlaces de pago disponibles.</p> : null}
        </div></section>
      </div>
    </>
  )
}
