import { AdminShell } from '@/components/layout/app-shell'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getInvoicesPageData } from '@/lib/data/invoices'
import { getAdminPaymentRequests } from '@/lib/data/payments'
import { PaymentForm } from '@/components/admin/payment-form'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

export default async function AdminPaymentsPage() {
  const identity = await requireAdmin()
  const [invoices, requests, locale] = await Promise.all([getInvoicesPageData(), getAdminPaymentRequests(), getLocale()])
  return (
    <AdminShell title="Pagos" description="Solicitudes de pago y enlaces externos." currentPath="/paneladmin/pagos" userEmail={identity.email} locale={locale}>
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <PaymentForm clients={invoices.clients} />
        <Card className="overflow-hidden">
          <div className="border-b border-line px-6 py-5"><h2 className="text-xl font-bold text-foreground">Solicitudes recientes</h2></div>
          <div className="divide-y divide-line">
            {requests.map(request => <div key={request.id} className="flex items-center justify-between gap-4 px-6 py-4"><div><p className="font-semibold text-foreground">{request.recipient_name}</p><p className="text-sm text-muted">{request.concept}</p></div><div className="text-right"><p className="font-semibold">{Number(request.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p><span className="text-xs uppercase tracking-wide text-muted">{request.status}</span></div></div>)}
            {requests.length === 0 ? <p className="px-6 py-8 text-sm text-muted">No hay solicitudes de pago.</p> : null}
          </div>
        </Card>
      </div>
    </AdminShell>
  )
}
