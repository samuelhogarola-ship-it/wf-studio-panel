import { requireClientAccess } from '@/lib/auth'
import { getClientFacturasData } from '@/lib/data/client'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
}

export default async function ClientFacturasPage() {
  const identity = await requireClientAccess()
  const invoices = await getClientFacturasData(identity.client.id)

  const pendingTotal = invoices
    .filter((i) => i.status === 'pending')
    .reduce((sum, i) => sum + Number(i.amount ?? 0), 0)

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-foreground">Facturas</h1>
        <p className="mt-0.5 text-sm text-slate-500">Historial de facturación y estado de pagos.</p>
      </div>

      {pendingTotal > 0 && (
        <div className="mb-6 flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-amber-900">
              Tienes {pendingTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} pendiente de pago
            </p>
            <p className="text-sm text-amber-700">Contacta con el estudio si tienes dudas sobre alguna factura.</p>
          </div>
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <p className="text-slate-400 text-sm">Aún no hay facturas registradas.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Nº</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Concepto</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Fecha</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Método</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Importe</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">{inv.number}</td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-foreground">{inv.concept}</p>
                      {inv.notes && <p className="mt-0.5 text-xs text-slate-400">{inv.notes}</p>}
                    </td>
                    <td className="px-5 py-4 text-slate-500">{formatDate(inv.issued_at)}</td>
                    <td className="px-5 py-4 text-slate-500">{PAYMENT_LABELS[inv.payment_method] ?? inv.payment_method}</td>
                    <td className="px-5 py-4 text-right font-semibold text-foreground">
                      {Number(inv.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {inv.status === 'paid' ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-semibold text-emerald-700">
                          Pagado {inv.paid_at ? formatDate(inv.paid_at) : ''}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-3 py-0.5 text-xs font-semibold text-amber-700">Pendiente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <div className="md:hidden divide-y divide-slate-100">
            {invoices.map((inv) => (
              <div key={inv.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div>
                    <p className="font-semibold text-foreground">{inv.concept}</p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{inv.number} · {formatDate(inv.issued_at)}</p>
                  </div>
                  <p className="font-bold text-foreground shrink-0">
                    {Number(inv.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {inv.status === 'paid' ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Pagado</span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Pendiente</span>
                  )}
                  <span className="text-xs text-slate-400">{PAYMENT_LABELS[inv.payment_method] ?? inv.payment_method}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
