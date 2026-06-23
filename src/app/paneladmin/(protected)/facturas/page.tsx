import Link from 'next/link'

import { InvoiceForm } from '@/components/admin/invoice-form'
import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { deleteInvoiceAction, markInvoicePaidAction } from '@/lib/actions/invoices'
import { getInvoicesPageData } from '@/lib/data/invoices'
import { getLocale } from '@/lib/locale'
import { t } from '@/lib/i18n'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AdminFacturasPage() {
  const identity = await requireAdmin()
  const data = await getInvoicesPageData()
  const locale = await getLocale()

  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    cash: t(locale, 'invoices.payment.cash'),
    card: t(locale, 'invoices.payment.card'),
    transfer: t(locale, 'invoices.payment.transfer'),
  }

  return (
    <AdminShell
      title={t(locale, 'invoices.title')}
      description={t(locale, 'invoices.description')}
      currentPath="/paneladmin/facturas"
      userEmail={identity.email}
      locale={locale}
    >
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <InvoiceForm clients={data.clients} locale={locale} />

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
                        {invoice.status === 'paid' ? t(locale, 'invoices.list.paid') : t(locale, 'invoices.list.pending')}
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
                        {invoice.status === 'pending' ? (
                          <form action={markInvoicePaidAction}>
                            <input type="hidden" name="id" value={invoice.id} />
                            <button className="rounded-full bg-emerald-50 px-3 py-2 font-semibold text-emerald-700">{t(locale, 'invoices.list.markPaid')}</button>
                          </form>
                        ) : null}
                        <form action={deleteInvoiceAction}>
                          <input type="hidden" name="id" value={invoice.id} />
                          <button className="rounded-full bg-rose-50 px-3 py-2 font-semibold text-rose-700">{t(locale, 'invoices.list.delete')}</button>
                        </form>
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
