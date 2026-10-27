import Link from 'next/link'
import { AdminShell } from '@/components/layout/app-shell'
import { DocumentEditor } from '@/components/billing/document-editor'
import { IncomeForm } from '@/components/billing/income-form'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getBillingWorkspaceData } from '@/lib/data/billing-documents'
import { getLedgerSummary } from '@/lib/data/ledger'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

export default async function AccountingPage() {
  const now = new Date()
  const monthFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`
  const [identity, data, ledger, locale] = await Promise.all([requireAdmin(), getBillingWorkspaceData(), getLedgerSummary({ from: monthFrom, to: monthTo }), getLocale()])
  return <AdminShell title="Documentos y contabilidad" description="Propuestas, facturas, cobros, ingresos y gastos." currentPath="/paneladmin/contabilidad" userEmail={identity.email} locale={locale}>
    <div className="mb-6 flex flex-wrap gap-3"><Link href="/paneladmin/contabilidad/productos" className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white">Editar productos</Link></div>
    <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]"><DocumentEditor products={data.products} clients={data.clients} /><Card className="overflow-hidden"><div className="border-b border-line px-6 py-5"><h2 className="text-xl font-bold">Documentos recientes</h2></div><div className="divide-y divide-line">{data.documents.map(document => <Link key={document.id} href={`/paneladmin/contabilidad/documentos/${document.id}`} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50"><div><p className="font-semibold">{document.number ?? 'Borrador'} · {document.title}</p><p className="text-sm text-muted">{document.document_type === 'proposal' ? 'Propuesta' : 'Factura'} · {document.recipient_name}</p></div><p className="font-bold">{(document.total_cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p></Link>)}{data.documents.length === 0 ? <p className="px-6 py-8 text-sm text-muted">Aún no hay documentos.</p> : null}</div></Card></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_.7fr]"><IncomeForm /><Card className="p-6"><h2 className="text-xl font-bold">Ingresos del mes</h2><dl className="mt-5 space-y-4"><div><dt className="text-sm text-muted">Suma de registros individuales</dt><dd className="text-2xl font-black">{(ledger.individualTotal / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</dd></div><div className="border-t border-line pt-4"><dt className="text-sm text-muted">Total mensual directo (referencia separada)</dt><dd className="text-2xl font-black">{(ledger.manualSummaryTotal / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</dd></div></dl><p className="mt-4 text-xs text-muted">No se suman entre sí automáticamente para evitar duplicidades.</p></Card></div>
  </AdminShell>
}
