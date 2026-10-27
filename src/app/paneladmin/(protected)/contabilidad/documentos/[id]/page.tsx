import { notFound } from 'next/navigation'
import { z } from 'zod'
import { issueBillingDocumentAction } from '@/lib/actions/billing-documents'
import { PaymentPanel } from '@/components/billing/payment-panel'
import { PrintButton } from '@/components/billing/print-button'
import { SharePanel } from '@/components/billing/share-panel'
import { AdminShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getBillingDocument } from '@/lib/data/billing-documents'
import { getLocale } from '@/lib/locale'

export default async function BillingDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()
  const [identity, bundle, locale] = await Promise.all([requireAdmin(), getBillingDocument(id), getLocale()])
  if (!bundle) notFound()
  const { document, lines, payments, paymentOption, activeShare } = bundle
  const paidCents = payments.filter(payment => !payment.reversed_at).reduce((sum, payment) => sum + payment.amount_cents, 0)
  return <AdminShell title={document.number ?? 'Borrador'} description={document.title} currentPath="/paneladmin/contabilidad" userEmail={identity.email} locale={locale}>
    <div className="mb-4 flex flex-wrap gap-3"><PrintButton label="Imprimir / guardar PDF" />{document.status === 'draft' ? <form action={issueBillingDocumentAction}><input type="hidden" name="document_id" value={document.id} /><Button type="submit">Emitir documento</Button></form> : null}</div>
    {document.tax_breakdown_review_required ? <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900 print:hidden">Desglose fiscal pendiente de revisar. El total histórico se ha conservado sin atribuirle automáticamente un tratamiento de IVA.</div> : null}
    <Card className="mb-6 p-8 print:border-0 print:shadow-none"><div className="flex justify-between gap-6"><div><p className="text-xs font-bold uppercase tracking-widest text-brand">{document.document_type === 'proposal' ? 'Propuesta' : document.document_type === 'advance_invoice' ? 'Factura de anticipo' : 'Factura'}</p><h1 className="mt-2 text-3xl font-black">{document.title}</h1><p className="mt-2 whitespace-pre-line text-muted">{document.recipient_company || document.recipient_name}</p><p className="text-muted">{document.recipient_email}</p></div><div className="text-right"><p className="font-mono font-bold">{document.number ?? 'BORRADOR'}</p><p className="text-sm text-muted">{document.document_date}</p></div></div><div className="mt-8 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-line text-left"><th className="py-3">Concepto</th><th>Cantidad</th><th className="text-right">Base</th><th className="text-right">IVA</th><th className="text-right">Total</th></tr></thead><tbody>{lines.map(line => <tr key={line.id} className="border-b border-line"><td className="py-4">{line.description}</td><td>{line.quantity}</td><td className="text-right">{(line.net_cents / 100).toFixed(2)} €</td><td className="text-right">{(line.tax_cents / 100).toFixed(2)} €</td><td className="text-right font-semibold">{(line.total_cents / 100).toFixed(2)} €</td></tr>)}</tbody></table></div><div className="mt-6 ml-auto max-w-sm space-y-2 text-right"><p>Base: {(document.net_cents / 100).toFixed(2)} €</p><p>IVA: {(document.tax_cents / 100).toFixed(2)} €</p><p className="text-2xl font-black">Total: {(document.total_cents / 100).toFixed(2)} €</p><p className="font-semibold text-emerald-700">Pagado: {(paidCents / 100).toFixed(2)} €</p><p className="font-semibold text-amber-700">Saldo pendiente: {((document.total_cents - paidCents) / 100).toFixed(2)} €</p></div></Card>
    {document.status !== 'draft' ? <><PaymentPanel documentId={document.id} totalCents={document.total_cents} payments={payments} paymentOption={paymentOption} /><div className="mt-6"><SharePanel documentId={document.id} canShare={document.status === 'issued'} activeShareId={activeShare?.id} /></div></> : null}
  </AdminShell>
}
