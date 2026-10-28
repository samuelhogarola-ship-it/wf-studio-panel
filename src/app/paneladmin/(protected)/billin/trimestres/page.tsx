import Link from 'next/link'

import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { quarterBounds } from '@/lib/billin/periods.mjs'
import { getBillinPeriodData } from '@/lib/data/billin'
import { getLocale } from '@/lib/locale'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const euro = (value: number) => value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })

export default async function BillinQuarterPage({ searchParams }: { searchParams?: Promise<{ year?: string; quarter?: string }> }) {
  const identity = await requireAdmin()
  const params = searchParams ? await searchParams : {}
  const period = quarterBounds(params.year, params.quarter)
  const [locale, data] = await Promise.all([getLocale(), getBillinPeriodData(period)])

  return (
    <AdminShell title="Bill-in · Preparación trimestral" description="Revisa ingresos, cobros y gastos antes de preparar la documentación del trimestre." currentPath="/paneladmin/billin/trimestres" userEmail={identity.email} locale={locale}>
      <Card className="mb-6 p-5">
        <form method="get" className="flex flex-wrap items-end gap-4">
          <label className="text-sm font-semibold text-foreground">Año<input className="mt-2 block min-h-11 w-32 rounded-2xl border border-line px-4 font-normal" type="number" name="year" min="2000" max="2100" defaultValue={period.year} /></label>
          <label className="text-sm font-semibold text-foreground">Trimestre<select className="mt-2 block min-h-11 w-44 rounded-2xl border border-line px-4 font-normal" name="quarter" defaultValue={period.quarter}><option value="1">1.º · ene–mar</option><option value="2">2.º · abr–jun</option><option value="3">3.º · jul–sep</option><option value="4">4.º · oct–dic</option></select></label>
          <button className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-white" type="submit">Preparar periodo</button>
          <Link href={`/paneladmin/billin/trimestres/export?year=${period.year}&quarter=${period.quarter}`} className="flex min-h-11 items-center rounded-full bg-emerald-50 px-5 text-sm font-semibold text-emerald-700">Descargar CSV</Link>
        </form>
      </Card>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Periodo seleccionado</p><h2 className="text-2xl font-bold text-foreground">{period.label}</h2></div><p className="max-w-xl text-sm text-muted">Borrador de control interno. No sustituye la revisión fiscal profesional ni presenta impuestos automáticamente.</p></div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[['Facturado', data.summary.totals.invoiced], ['Cobrado', data.summary.totals.collected], ['Gastos pagados', data.summary.totals.expenses], ['Resultado de caja', data.summary.totals.net]].map(([label, value]) => <Card key={label as string} className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label as string}</p><p className="mt-2 text-2xl font-bold text-foreground">{euro(value as number)}</p></Card>)}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {[['Contabilidad general', data.summary.areas.general], ['Contabilidad de clases', data.summary.areas.classes]].map(([label, raw]) => {
          const area = raw as typeof data.summary.areas.general
          return <Card key={label as string} className="p-6"><h2 className="text-lg font-bold text-foreground">{label as string}</h2><div className="mt-4 grid grid-cols-2 gap-4 text-sm"><div><p className="text-muted">Facturado</p><p className="font-bold">{euro(area.invoiced)}</p></div><div><p className="text-muted">Cobrado</p><p className="font-bold">{euro(area.collected)}</p></div><div><p className="text-muted">Gastos</p><p className="font-bold">{euro(area.expenses)}</p></div><div><p className="text-muted">Resultado</p><p className="font-bold">{euro(area.net)}</p></div></div></Card>
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden"><div className="border-b border-line px-6 py-5"><h2 className="text-lg font-bold">Documentos del trimestre</h2><p className="text-sm text-muted">{data.invoices.length} facturas y propuestas.</p></div><div className="divide-y divide-line">{data.invoices.map((item) => <div key={item.id} className="flex justify-between gap-3 px-6 py-4 text-sm"><div><p className="font-semibold">{item.number} · {item.concept}</p><p className="text-muted">{formatDate(item.issued_at)}</p></div><div className="text-right"><p className="font-bold">{euro(Number(item.amount))}</p><Badge>{item.document_type === 'proposal' ? 'Propuesta' : item.status === 'paid' ? 'Cobrada' : 'Pendiente'}</Badge></div></div>)}{data.invoices.length === 0 ? <p className="px-6 py-8 text-sm text-muted">Sin documentos en este trimestre.</p> : null}</div></Card>
        <Card className="overflow-hidden"><div className="border-b border-line px-6 py-5"><h2 className="text-lg font-bold">Gastos del trimestre</h2><p className="text-sm text-muted">{data.expenses.length} apuntes.</p></div><div className="divide-y divide-line">{data.expenses.map((item) => <div key={item.id} className="flex justify-between gap-3 px-6 py-4 text-sm"><div><p className="font-semibold">{item.supplier} · {item.concept}</p><p className="text-muted">{formatDate(item.expense_date)}</p></div><div className="text-right"><p className="font-bold">{euro(Number(item.amount))}</p><Badge>{item.expense_nature === 'fixed' ? 'Fijo mensual' : item.expense_nature === 'recurring' ? 'Recurrente' : 'Único'}</Badge></div></div>)}{data.expenses.length === 0 ? <p className="px-6 py-8 text-sm text-muted">Sin gastos en este trimestre.</p> : null}</div></Card>
      </div>
    </AdminShell>
  )
}

