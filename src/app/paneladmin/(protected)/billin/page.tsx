import Link from 'next/link'

import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getBillinDashboardData } from '@/lib/data/billin'
import { getLocale } from '@/lib/locale'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const euro = (value: number) => value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })

export default async function BillinDashboardPage() {
  const identity = await requireAdmin()
  const [locale, data] = await Promise.all([getLocale(), getBillinDashboardData()])
  const { summary } = data
  const metrics = [
    { label: 'Facturado', value: summary.totals.invoiced, detail: `${summary.counts.invoices} facturas` },
    { label: 'Cobrado', value: summary.totals.collected, detail: `${summary.counts.pendingInvoices} pendientes` },
    { label: 'Gastos pagados', value: summary.totals.expenses, detail: `${summary.counts.expenses} apuntes` },
    { label: 'Resultado de caja', value: summary.totals.net, detail: `${summary.counts.proposals} propuestas` },
  ]

  return (
    <AdminShell title="Bill-in" description="Facturación y contabilidad del estudio en un solo lugar." currentPath="/paneladmin/billin" userEmail={identity.email} locale={locale}>
      <div className="mb-6 flex flex-wrap gap-3">
        <Link href="/paneladmin/facturas" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white">Crear factura o propuesta</Link>
        <Link href="/paneladmin/gastos" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Registrar gasto</Link>
        <Link href="/paneladmin/billin/trimestres" className="rounded-full bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">Preparar trimestre</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{euro(metric.value)}</p>
            <p className="mt-1 text-sm text-muted">{metric.detail}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {[
          ['Contabilidad general', summary.areas.general],
          ['Contabilidad de clases', summary.areas.classes],
        ].map(([label, area]) => {
          const values = area as typeof summary.areas.general
          return (
            <Card key={label as string} className="p-6">
              <h2 className="text-lg font-bold text-foreground">{label as string}</h2>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted">Facturado</p><p className="font-bold text-foreground">{euro(values.invoiced)}</p></div>
                <div><p className="text-muted">Cobrado</p><p className="font-bold text-foreground">{euro(values.collected)}</p></div>
                <div><p className="text-muted">Gastos</p><p className="font-bold text-foreground">{euro(values.expenses)}</p></div>
                <div><p className="text-muted">Resultado</p><p className="font-bold text-foreground">{euro(values.net)}</p></div>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-6 py-5"><h2 className="text-lg font-bold text-foreground">Facturas y propuestas recientes</h2><Link href="/paneladmin/facturas" className="text-sm font-semibold text-brand">Ver histórico</Link></div>
          <div className="divide-y divide-line">
            {data.recentInvoices.map((invoice) => <div key={invoice.id} className="flex items-center justify-between gap-4 px-6 py-4 text-sm"><div><p className="font-semibold text-foreground">{invoice.number} · {invoice.concept}</p><p className="text-muted">{formatDate(invoice.issued_at)}</p></div><div className="text-right"><p className="font-bold text-foreground">{euro(Number(invoice.amount))}</p><Badge>{invoice.document_type === 'proposal' ? 'Propuesta' : invoice.status === 'paid' ? 'Cobrada' : 'Pendiente'}</Badge></div></div>)}
            {data.recentInvoices.length === 0 ? <p className="px-6 py-8 text-sm text-muted">Todavía no hay facturas ni propuestas.</p> : null}
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-6 py-5"><h2 className="text-lg font-bold text-foreground">Gastos recientes</h2><Link href="/paneladmin/gastos" className="text-sm font-semibold text-brand">Ver histórico</Link></div>
          <div className="divide-y divide-line">
            {data.recentExpenses.map((expense) => <div key={expense.id} className="flex items-center justify-between gap-4 px-6 py-4 text-sm"><div><p className="font-semibold text-foreground">{expense.supplier}</p><p className="text-muted">{expense.concept} · {formatDate(expense.expense_date)}</p></div><div className="text-right"><p className="font-bold text-foreground">{euro(Number(expense.amount))}</p><Badge>{expense.accounting_area === 'classes' ? 'Clases' : 'General'}</Badge></div></div>)}
            {data.recentExpenses.length === 0 ? <p className="px-6 py-8 text-sm text-muted">Todavía no hay gastos registrados.</p> : null}
          </div>
        </Card>
      </div>
    </AdminShell>
  )
}

