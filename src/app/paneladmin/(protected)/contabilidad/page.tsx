import Link from 'next/link'
import { AdminShell } from '@/components/layout/app-shell'
import { DocumentEditor } from '@/components/billing/document-editor'
import { IncomeForm } from '@/components/billing/income-form'
import { ExpenseForm } from '@/components/billing/expense-form'
import { PeriodSummary } from '@/components/billing/period-summary'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getBillingWorkspaceData } from '@/lib/data/billing-documents'
import { getLedgerSummary } from '@/lib/data/ledger'
import { getLocale } from '@/lib/locale'
import { resolveAccountingPeriod } from '@/lib/billing/csv'

export const dynamic = 'force-dynamic'

export default async function AccountingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams
  const now = new Date()
  const rawMode = typeof query.mode === 'string' ? query.mode : 'month'
  const mode = rawMode === 'quarter' || rawMode === 'year' ? rawMode : 'month'
  const year = Number(typeof query.year === 'string' ? query.year : now.getFullYear())
  const month = Number(typeof query.month === 'string' ? query.month : now.getMonth() + 1)
  const quarter = Number(typeof query.quarter === 'string' ? query.quarter : Math.floor(now.getMonth() / 3) + 1)
  const period = resolveAccountingPeriod({ mode, year, month, quarter })
  const [identity, data, ledger, locale] = await Promise.all([requireAdmin(), getBillingWorkspaceData(), getLedgerSummary({ from: period.from, to: period.to }), getLocale()])
  return <AdminShell title="Documentos y contabilidad" description="Propuestas, facturas, cobros, ingresos y gastos." currentPath="/paneladmin/contabilidad" userEmail={identity.email} locale={locale}>
    <div className="mb-6 flex flex-wrap gap-3"><Link href="/paneladmin/contabilidad/productos" className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white">Editar productos</Link></div>
    <PeriodSummary summary={ledger} period={period} mode={mode} year={year} month={month} quarter={quarter} />
    <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]"><DocumentEditor products={data.products} clients={data.clients} /><Card className="overflow-hidden"><div className="border-b border-line px-6 py-5"><h2 className="text-xl font-bold">Documentos recientes</h2></div><div className="divide-y divide-line">{data.documents.map(document => <Link key={document.id} href={`/paneladmin/contabilidad/documentos/${document.id}`} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50"><div><p className="font-semibold">{document.number ?? 'Borrador'} · {document.title}</p><p className="text-sm text-muted">{document.document_type === 'proposal' ? 'Propuesta' : 'Factura'} · {document.recipient_name}</p></div><p className="font-bold">{(document.total_cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p></Link>)}{data.documents.length === 0 ? <p className="px-6 py-8 text-sm text-muted">Aún no hay documentos.</p> : null}</div></Card></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-2"><IncomeForm /><ExpenseForm /></div>
  </AdminShell>
}
