import Link from 'next/link'

import { InvoiceForm } from '@/components/admin/invoice-form'
import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { deleteInvoiceAction, markInvoicePaidAction } from '@/lib/actions/invoices'
import { getInvoicesPageData } from '@/lib/data/invoices'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
}

export default async function AdminFacturasPage() {
  const identity = await requireAdmin()
  const data = await getInvoicesPageData()

  return (
    <AdminShell title="Facturas" description="Gestión de facturas emitidas a clientes." currentPath="/paneladmin/facturas" userEmail={identity.email}>
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <InvoiceForm clients={data.clients} />

        <Card className="overflow-hidden">
          <div className="border-b border-line px-6 py-5">
            <h2 className="text-xl font-bold text-foreground">Facturas emitidas</h2>
            <p className="text-sm text-muted">Historial completo de facturas, ordenado por fecha.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-6 py-4">Número</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Concepto</th>
                  <th className="px-6 py-4">Importe</th>
                  <th className="px-6 py-4">Método</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-6 py-4 font-mono text-sm font-semibold text-foreground">{invoice.number}</td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-foreground">{invoice.clients?.name ?? '—'}</p>
                      <p className="text-slate-500">{invoice.clients?.email ?? ''}</p>
                    </td>
                    <td className="max-w-[200px] px-6 py-4 text-slate-600">
                      <p className="line-clamp-2">{invoice.concept}</p>
                    </td>
                    <td className="px-6 py-4 font-semibold text-foreground">
                      {Number(invoice.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{PAYMENT_METHOD_LABELS[invoice.payment_method] ?? invoice.payment_method}</td>
                    <td className="px-6 py-4">
                      <Badge className={invoice.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>
                        {invoice.status === 'paid' ? 'Pagada' : 'Pendiente'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{formatDate(invoice.issued_at)}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/paneladmin/facturas/${invoice.id}/print`}
                          target="_blank"
                          className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700"
                        >
                          Imprimir
                        </Link>
                        {invoice.status === 'pending' ? (
                          <form action={markInvoicePaidAction}>
                            <input type="hidden" name="id" value={invoice.id} />
                            <button className="rounded-full bg-emerald-50 px-3 py-2 font-semibold text-emerald-700">Marcar pagada</button>
                          </form>
                        ) : null}
                        <form action={deleteInvoiceAction}>
                          <input type="hidden" name="id" value={invoice.id} />
                          <button className="rounded-full bg-rose-50 px-3 py-2 font-semibold text-rose-700">Eliminar</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.invoices.length === 0 ? <p className="px-6 py-8 text-sm text-muted">Aún no hay facturas emitidas.</p> : null}
          </div>
        </Card>
      </div>
    </AdminShell>
  )
}
