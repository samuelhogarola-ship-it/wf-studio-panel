import Link from 'next/link'

import { InvoiceForm } from '@/components/admin/invoice-form'
import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { markInvoicePaidAction } from '@/lib/actions/invoices'
import { getInvoicesPageData } from '@/lib/data/invoices'
import { getLocale } from '@/lib/locale'
import { t } from '@/lib/i18n'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function getBillingEmail(company: string | null | undefined, fallbackEmail: string | null | undefined) {
  const fiscalEmail = company?.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0]
  return fiscalEmail ?? fallbackEmail ?? ''
}

export default async function AdminFacturasPage({
  searchParams,
}: {
  searchParams?: Promise<{ client?: string; month?: string; type?: string; status?: string; area?: string }>
}) {
  const identity = await requireAdmin()
  const params = searchParams ? await searchParams : {}
  const filters = { month: params.month, type: params.type, status: params.status, area: params.area }
  const data = await getInvoicesPageData(filters)
  const locale = await getLocale()

  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    cash: t(locale, 'invoices.payment.cash'),
    card: t(locale, 'invoices.payment.card'),
    transfer: t(locale, 'invoices.payment.transfer'),
  }

  return (
    <AdminShell
      title="Bill-in · Facturas y propuestas"
      description="Emite documentos, enlaza el cobro y conserva el histórico contable."
      currentPath="/paneladmin/facturas"
      userEmail={identity.email}
      locale={locale}
    >
      <Card className="mb-6 p-5">
        <form method="get" className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {params.client ? <input type="hidden" name="client" value={params.client} /> : null}
          <label className="text-sm font-semibold text-foreground">Mes<input className="mt-2 min-h-11 w-full rounded-2xl border border-line px-4 font-normal" type="month" name="month" defaultValue={params.month ?? ''} /></label>
          <label className="text-sm font-semibold text-foreground">Documento<select className="mt-2 min-h-11 w-full rounded-2xl border border-line px-4 font-normal" name="type" defaultValue={params.type ?? ''}><option value="">Todos</option><option value="invoice">Facturas</option><option value="proposal">Propuestas</option></select></label>
          <label className="text-sm font-semibold text-foreground">Estado<select className="mt-2 min-h-11 w-full rounded-2xl border border-line px-4 font-normal" name="status" defaultValue={params.status ?? ''}><option value="">Todos</option><option value="issued">Pendiente / emitida</option><option value="paid">Cobrada</option><option value="void">Anulada</option></select></label>
          <label className="text-sm font-semibold text-foreground">Contabilidad<select className="mt-2 min-h-11 w-full rounded-2xl border border-line px-4 font-normal" name="area" defaultValue={params.area ?? ''}><option value="">Todas</option><option value="general">General</option><option value="classes">Clases</option></select></label>
          <div className="flex items-end gap-2"><button className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-white" type="submit">Filtrar</button><Link href="/paneladmin/facturas" className="flex min-h-11 items-center rounded-full bg-slate-100 px-4 text-sm font-semibold text-slate-700">Limpiar filtros</Link></div>
        </form>
        <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-line pt-4 text-sm"><span className="font-semibold text-foreground">{data.invoices.length} documentos</span><span className="font-semibold text-foreground">Total filtrado · {data.filteredTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></div>
      </Card>
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <InvoiceForm clients={data.clients} locale={locale} defaultClientId={params.client} />

        <Card className="overflow-hidden">
          <div className="border-b border-line px-6 py-5">
            <h2 className="text-xl font-bold text-foreground">{t(locale, 'invoices.list.title')}</h2>
            <p className="text-sm text-muted">{t(locale, 'invoices.list.description')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-6 py-4">{t(locale, 'invoices.list.col.number')}</th>
                  <th className="px-6 py-4">{t(locale, 'invoices.list.col.client')}</th>
                  <th className="px-6 py-4">{t(locale, 'invoices.list.col.concept')}</th>
                  <th className="px-6 py-4">{t(locale, 'invoices.list.col.amount')}</th>
                  <th className="px-6 py-4">{t(locale, 'invoices.list.col.method')}</th>
                  <th className="px-6 py-4">{t(locale, 'invoices.list.col.status')}</th>
                  <th className="px-6 py-4">{t(locale, 'invoices.list.col.date')}</th>
                  <th className="px-6 py-4">{t(locale, 'invoices.list.col.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-6 py-4 font-mono text-sm font-semibold text-foreground">
                      <span className="block">{invoice.number}</span>
                      <Badge className={invoice.document_type === 'proposal' ? 'mt-1 bg-violet-50 text-violet-700' : 'mt-1 bg-blue-50 text-blue-700'}>{invoice.document_type === 'proposal' ? 'Propuesta' : 'Factura'} · {invoice.accounting_area === 'classes' ? 'Clases' : 'General'}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-foreground">{invoice.recipient_company?.split('\n')[0] ?? invoice.recipient_name ?? invoice.clients?.company?.split('\n')[0] ?? invoice.clients?.name ?? '—'}</p>
                      <p className="text-slate-500">{invoice.recipient_email ?? getBillingEmail(invoice.clients?.company, invoice.clients?.email)}</p>
                    </td>
                    <td className="max-w-[200px] px-6 py-4 text-slate-600">
                      <p className="line-clamp-2">{invoice.concept}</p>
                    </td>
                    <td className="px-6 py-4 font-semibold text-foreground">
                      {Number(invoice.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{PAYMENT_METHOD_LABELS[invoice.payment_method] ?? invoice.payment_method}</td>
                    <td className="px-6 py-4">
                      <Badge className={invoice.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : invoice.status === 'void' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}>
                        {invoice.document_type === 'proposal' ? 'Emitida' : invoice.status === 'paid' ? t(locale, 'invoices.list.paid') : invoice.status === 'void' ? 'Anulada' : t(locale, 'invoices.list.pending')}
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
                          {t(locale, 'invoices.list.print')}
                        </Link>
                        {invoice.status === 'issued' && invoice.document_type === 'invoice' ? (
                          <form action={markInvoicePaidAction}>
                            <input type="hidden" name="id" value={invoice.id} />
                            <button className="rounded-full bg-emerald-50 px-3 py-2 font-semibold text-emerald-700">{t(locale, 'invoices.list.markPaid')}</button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.invoices.length === 0 ? <p className="px-6 py-8 text-sm text-muted">{t(locale, 'invoices.list.empty')}</p> : null}
          </div>
        </Card>
      </div>
    </AdminShell>
  )
}
