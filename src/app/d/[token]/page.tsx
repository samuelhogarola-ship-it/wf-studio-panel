import { notFound } from 'next/navigation'

import { getSharedBillingDocument } from '@/lib/data/billing-shares'

export const dynamic = 'force-dynamic'
const money = (cents: number) => (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })

export default async function SharedBillingDocumentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const bundle = await getSharedBillingDocument(token)
  if (!bundle) notFound()
  const paidCents = bundle.payments.reduce((sum, payment) => sum + payment.amount_cents, 0)
  const balanceCents = Math.max(0, bundle.document.total_cents - paidCents)
  const paymentOption = bundle.paymentOption
  return <main className="mx-auto min-h-screen max-w-3xl bg-white px-5 py-10 text-slate-900 sm:px-8">
    <header className="border-b border-slate-200 pb-6"><p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">WF Studio</p><h1 className="mt-2 text-3xl font-black">{bundle.document.title}</h1><p className="mt-2 text-sm text-slate-500">{bundle.document.number ?? 'Documento'} · {bundle.document.document_date}</p></header>
    <section className="py-6"><p className="text-sm text-slate-500">Destinatario</p><p className="font-semibold">{bundle.document.recipient_name}</p></section>
    <div className="overflow-hidden rounded-xl border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left">Concepto</th><th className="px-4 py-3 text-right">Total</th></tr></thead><tbody>{bundle.lines.map(line => <tr key={line.id} className="border-t border-slate-100"><td className="px-4 py-3">{line.description}</td><td className="px-4 py-3 text-right font-semibold">{money(line.total_cents)}</td></tr>)}</tbody></table></div>
    <section className="ml-auto mt-6 max-w-sm space-y-2 text-sm"><div className="flex justify-between"><span>Base</span><span>{money(bundle.document.net_cents)}</span></div><div className="flex justify-between"><span>IVA</span><span>{money(bundle.document.tax_cents)}</span></div><div className="flex justify-between border-t pt-2 text-lg font-bold"><span>Total</span><span>{money(bundle.document.total_cents)}</span></div><div className="flex justify-between text-emerald-700"><span>Pagado</span><span>{money(paidCents)}</span></div><div className="flex justify-between text-lg font-black"><span>Saldo pendiente</span><span>{money(balanceCents)}</span></div></section>
    {balanceCents > 0 && paymentOption ? <section className="mt-8 rounded-2xl border border-brand/20 bg-brand/5 p-5"><h2 className="font-bold">Forma de pago</h2>{paymentOption.instructions ? <p className="mt-2 whitespace-pre-wrap text-sm">{paymentOption.instructions}</p> : null}{paymentOption.method === 'manual_link' && paymentOption.url ? <a href={paymentOption.url} rel="noreferrer" className="mt-4 inline-flex rounded-full bg-brand px-5 py-2.5 font-semibold text-white">Pagar ahora</a> : null}<p className="mt-3 text-xs text-slate-500">Este enlace privado deja de funcionar en 7 días o cuando el documento queda pagado.</p></section> : null}
  </main>
}
