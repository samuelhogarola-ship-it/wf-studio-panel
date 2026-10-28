import Link from 'next/link'

import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { monthBounds } from '@/lib/billin/periods.mjs'
import { getBillinDashboardData } from '@/lib/data/billin'
import { getLocale } from '@/lib/locale'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const euro = (value: number) => value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })

export default async function BillinDashboardPage({ searchParams }: { searchParams?: Promise<{ month?: string }> }) {
  const identity = await requireAdmin()
  const params = searchParams ? await searchParams : {}
  const period = monthBounds(params.month)
  const [locale, data] = await Promise.all([getLocale(), getBillinDashboardData({ start: period.start, end: period.end })])
  const { summary } = data
  const metrics = [
    { label: 'Facturado', value: summary.totals.invoiced, detail: `${summary.counts.invoices} facturas` },
    { label: 'Cobrado', value: summary.totals.collected, detail: `${summary.counts.pendingInvoices} pendientes` },
    { label: 'Gastos pagados', value: summary.totals.expenses, detail: `${summary.counts.expenses} apuntes` },
    { label: 'Resultado de caja', value: summary.totals.net, detail: `${summary.counts.proposals} propuestas` },
  ]
  const movements = [
    ...data.recentInvoices.map((invoice) => ({
      id: `invoice-${invoice.id}`, date: invoice.issued_at,
      kind: invoice.document_type === 'proposal' ? 'Propuesta' : 'Factura', reference: invoice.number,
      concept: invoice.concept, area: invoice.accounting_area === 'classes' ? 'Clases' : 'General',
      status: invoice.document_type === 'proposal' ? 'Emitida' : invoice.status === 'paid' ? 'Cobrada' : invoice.status === 'void' ? 'Anulada' : 'Pendiente',
      amount: Number(invoice.amount), href: `/paneladmin/facturas/${invoice.id}/print`,
    })),
    ...data.recentExpenses.map((expense) => ({
      id: `expense-${expense.id}`, date: expense.expense_date, kind: 'Gasto', reference: expense.supplier,
      concept: expense.concept, area: expense.accounting_area === 'classes' ? 'Clases' : 'General',
      status: expense.status === 'paid' ? 'Pagado' : expense.status === 'void' ? 'Anulado' : 'Pendiente',
      amount: -Number(expense.amount), href: '/paneladmin/gastos',
    })),
  ].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 10)

  return (
    <AdminShell title="Bill-in" description="Facturación y contabilidad del estudio en un solo lugar." currentPath="/paneladmin/billin" userEmail={identity.email} locale={locale}>
      <Card className="mb-4 flex flex-wrap items-end justify-between gap-3 p-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Periodo contable</p><h2 className="mt-1 text-xl font-bold text-foreground">Resumen de {period.label}</h2></div>
        <div className="flex flex-wrap items-end gap-2">
          <form method="get" className="flex items-end gap-2"><label className="text-sm font-semibold text-foreground">Mes<input className="mt-1 block min-h-10 rounded-xl border border-line px-3 font-normal" type="month" name="month" defaultValue={period.key} /></label><button className="min-h-10 rounded-full bg-slate-900 px-4 text-sm font-semibold text-white" type="submit">Cambiar</button></form>
          <Link href="/paneladmin/facturas" className="flex min-h-10 items-center rounded-full bg-brand px-4 text-sm font-semibold text-white">+ Factura</Link>
          <Link href="/paneladmin/gastos" className="flex min-h-10 items-center rounded-full bg-slate-100 px-4 text-sm font-semibold text-slate-700">+ Gasto</Link>
          <Link href="/paneladmin/billin/trimestres" className="flex min-h-10 items-center rounded-full bg-violet-50 px-4 text-sm font-semibold text-violet-700">Preparar trimestre</Link>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
            <div className="mt-1 flex items-end justify-between gap-2"><p className="text-2xl font-bold text-foreground">{euro(metric.value)}</p><p className="pb-1 text-xs text-muted">{metric.detail}</p></div>
          </Card>
        ))}
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="border-b border-line px-5 py-3"><h2 className="text-base font-bold text-foreground">Resumen por actividad</h2></div>
        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-3">Actividad</th><th className="px-5 py-3 text-right">Facturado</th><th className="px-5 py-3 text-right">Cobrado</th><th className="px-5 py-3 text-right">Gastos</th><th className="px-5 py-3 text-right">Resultado</th></tr></thead><tbody className="divide-y divide-line">{[['Contabilidad general', summary.areas.general], ['Contabilidad de clases', summary.areas.classes]].map(([label, raw]) => { const area = raw as typeof summary.areas.general; return <tr key={label as string}><td className="px-5 py-3 font-semibold text-foreground">{label as string}</td><td className="px-5 py-3 text-right">{euro(area.invoiced)}</td><td className="px-5 py-3 text-right">{euro(area.collected)}</td><td className="px-5 py-3 text-right">{euro(area.expenses)}</td><td className="px-5 py-3 text-right font-bold">{euro(area.net)}</td></tr> })}</tbody></table></div>
      </Card>

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3"><div><h2 className="text-base font-bold text-foreground">Movimientos recientes</h2><p className="text-xs text-muted">Facturas, propuestas y gastos de {period.label}.</p></div><div className="flex gap-3 text-sm font-semibold"><Link href={`/paneladmin/facturas?month=${period.key}`} className="text-brand">Histórico de facturas</Link><Link href="/paneladmin/gastos" className="text-brand">Histórico de gastos</Link></div></div>
        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-3">Fecha</th><th className="px-5 py-3">Movimiento</th><th className="px-5 py-3">Documento / proveedor</th><th className="px-5 py-3">Concepto</th><th className="px-5 py-3">Área</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3 text-right">Importe</th></tr></thead><tbody className="divide-y divide-line">{movements.map((movement) => <tr key={movement.id}><td className="whitespace-nowrap px-5 py-3 text-muted">{formatDate(movement.date)}</td><td className="px-5 py-3"><Badge>{movement.kind}</Badge></td><td className="px-5 py-3 font-semibold"><Link href={movement.href} className="text-foreground hover:text-brand">{movement.reference}</Link></td><td className="max-w-xs px-5 py-3 text-muted"><p className="line-clamp-1">{movement.concept}</p></td><td className="px-5 py-3">{movement.area}</td><td className="px-5 py-3">{movement.status}</td><td className={`whitespace-nowrap px-5 py-3 text-right font-bold ${movement.amount < 0 ? 'text-rose-700' : 'text-foreground'}`}>{euro(movement.amount)}</td></tr>)}</tbody></table>{movements.length === 0 ? <p className="px-5 py-6 text-sm text-muted">No hay movimientos en este mes.</p> : null}</div>
      </Card>
    </AdminShell>
  )
}

