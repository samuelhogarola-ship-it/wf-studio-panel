import Link from 'next/link'

import { BillinPeriodFilter } from '@/components/admin/billin-period-filter'
import { ExpenseForm } from '@/components/admin/expense-form'
import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { resolveAccountingPeriod } from '@/lib/billin/periods.mjs'
import { getExpensesPageData } from '@/lib/data/expenses'
import { getLocale } from '@/lib/locale'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const categoryLabels: Record<string, string> = {
  software: 'Software', services: 'Servicios', taxes: 'Impuestos', travel: 'Desplazamientos',
  office: 'Oficina', marketing: 'Marketing', classes: 'Clases', other: 'Otros',
}

const natureLabels: Record<string, string> = {
  fixed: 'Fijo mensual', recurring: 'Recurrente variable', one_off: 'Único',
}

export default async function AdminExpensesPage({ searchParams }: { searchParams?: Promise<{ client?: string; period?: string; month?: string; from?: string; to?: string; area?: string; page?: string }> }) {
  const identity = await requireAdmin()
  const locale = await getLocale()
  const params = searchParams ? await searchParams : {}
  const period = resolveAccountingPeriod(params.period || params.month ? params : { ...params, period: 'all' })
  const area = params.area === 'classes' ? 'classes' : params.area === 'general' ? 'general' : null
  const requestedPage = Math.max(0, Number.parseInt(params.page ?? '1', 10) - 1 || 0)
  const data = await getExpensesPageData({ area, page: requestedPage, ...(period.start && period.end ? { start: period.start, end: period.end } : {}) })
  const expenses = data.expenses
  const pageCount = Math.max(1, Math.ceil(data.count / data.pageSize))
  const periodParams = () => {
    const query = new URLSearchParams({ period: period.key })
    if (period.key === 'custom' && period.start && period.end) {
      query.set('from', period.start)
      const inclusiveEnd = new Date(`${period.end}T00:00:00.000Z`)
      inclusiveEnd.setUTCDate(inclusiveEnd.getUTCDate() - 1)
      query.set('to', inclusiveEnd.toISOString().slice(0, 10))
    }
    return query
  }
  const expensesHref = (page?: number, selectedArea = area) => {
    const query = periodParams()
    if (selectedArea) query.set('area', selectedArea)
    if (page) query.set('page', String(page))
    return `/paneladmin/gastos?${query.toString()}`
  }

  return (
    <AdminShell title="Bill-in · Gastos" description="Registra y consulta los gastos de la actividad general y de clases." currentPath="/paneladmin/gastos" userEmail={identity.email} locale={locale}>
      <div className="mb-4"><BillinPeriodFilter action="/paneladmin/gastos" period={period} preservedParams={{ client: params.client, area: params.area }} /></div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link href={expensesHref(undefined, null)} className={`rounded-full px-4 py-2 text-sm font-semibold ${!area ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700'}`}>Todos</Link>
        <Link href={expensesHref(undefined, 'general')} className={`rounded-full px-4 py-2 text-sm font-semibold ${area === 'general' ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700'}`}>General</Link>
        <Link href={expensesHref(undefined, 'classes')} className={`rounded-full px-4 py-2 text-sm font-semibold ${area === 'classes' ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700'}`}>Clases</Link>
        <span className="ml-auto text-sm font-semibold text-foreground">Total de {period.label}: {data.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Nuevo apunte</p>
          <h2 className="mb-5 mt-2 text-xl font-bold text-foreground">Registrar gasto</h2>
          <ExpenseForm clients={data.clients} accounts={data.accounts} defaultClientId={params.client} />
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-line px-6 py-5"><h2 className="text-xl font-bold text-foreground">Histórico de gastos</h2><p className="text-sm text-muted">{data.count} apuntes · página {data.page + 1} de {pageCount}.</p></div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-4">Fecha</th><th className="px-5 py-4">Proveedor / concepto</th><th className="px-5 py-4">Cliente</th><th className="px-5 py-4">Área</th><th className="px-5 py-4">Tipo</th><th className="px-5 py-4">Importe</th><th className="px-5 py-4">Estado</th></tr></thead>
              <tbody className="divide-y divide-line">
                {expenses.map((expense) => <tr key={expense.id}>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-500">{formatDate(expense.expense_date)}</td>
                  <td className="px-5 py-4"><p className="font-semibold text-foreground">{expense.supplier}</p><p className="text-slate-500">{expense.concept} · {categoryLabels[expense.category] ?? expense.category}</p></td>
                  <td className="px-5 py-4">{expense.client_id ? <Link href={`/paneladmin/clientes/${expense.client_id}`} className="font-semibold text-brand">{expense.clients?.name ?? 'Ver cliente'}</Link> : '—'}</td>
                  <td className="px-5 py-4"><Badge className={expense.accounting_area === 'classes' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-700'}>{expense.accounting_area === 'classes' ? 'Clases' : 'General'}</Badge></td>
                  <td className="px-5 py-4"><Badge className={expense.expense_nature === 'fixed' ? 'bg-blue-50 text-blue-700' : expense.expense_nature === 'recurring' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700'}>{natureLabels[expense.expense_nature] ?? 'Único'}</Badge></td>
                  <td className="px-5 py-4 font-semibold text-foreground">{Number(expense.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                  <td className="px-5 py-4"><Badge className={expense.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>{expense.status === 'paid' ? 'Pagado' : 'Pendiente'}</Badge></td>
                </tr>)}
              </tbody>
            </table>
            {expenses.length === 0 ? <p className="px-6 py-8 text-sm text-muted">Todavía no hay gastos en esta vista.</p> : null}
          </div>
          <div className="flex items-center justify-between border-t border-line px-6 py-4 text-sm">
            {data.page > 0 ? <Link href={expensesHref(data.page)} className="font-semibold text-brand">Página anterior</Link> : <span />}
            {data.page + 1 < pageCount ? <Link href={expensesHref(data.page + 2)} className="font-semibold text-brand">Página siguiente</Link> : <span />}
          </div>
        </Card>
      </div>
    </AdminShell>
  )
}
