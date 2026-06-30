import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getProjectSubscriptionsData } from '@/lib/data/admin'
import { getLocale } from '@/lib/locale'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const PROJECT = 'conoce-fuengirola'

const TYPE_LABELS: Record<string, string> = {
  subscription: 'Suscripción',
  membership: 'Membresía',
  hosting: 'Hosting',
  domain: 'Dominio',
  service: 'Servicio',
}

const CYCLE_LABELS: Record<string, string> = {
  monthly: 'Mensual',
  one_time: 'Único',
}

export default async function Page() {
  const identity = await requireAdmin()
  const locale = await getLocale()
  const data = await getProjectSubscriptionsData(PROJECT)

  return (
    <AdminShell
      title="Suscripciones — Conoce Fuengirola"
      description="Pagos recurrentes y suscripciones activas"
      currentPath="/paneladmin/conoce-fuengirola/suscripciones"
      userEmail={identity.email}
      locale={locale}
    >
      <section className="grid gap-4 md:grid-cols-3 mb-8">
        <Card className="p-5">
          <p className="text-sm text-muted">Suscripciones activas</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{data.stats.total}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Pendientes de cobro</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{data.stats.unpaid}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Ingresos mensuales</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-foreground">
            {data.stats.monthlyRevenue > 0 ? `${data.stats.monthlyRevenue.toFixed(0)} €` : '—'}
          </p>
        </Card>
      </section>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-6 py-4">Suscripción</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Precio</th>
                <th className="px-6 py-4">Ciclo</th>
                <th className="px-6 py-4">Renovación</th>
                <th className="px-6 py-4">Pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.packs.map((pack) => (
                <tr key={pack.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-foreground">{pack.name}</td>
                  <td className="px-6 py-4 text-slate-500">
                    {(pack.clients as { name: string } | null)?.name ?? '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {TYPE_LABELS[pack.pack_type] ?? pack.pack_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-foreground">
                    {pack.price !== null ? `${pack.price} €` : '—'}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {CYCLE_LABELS[pack.billing_cycle] ?? pack.billing_cycle}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {pack.renewal_date ? formatDate(pack.renewal_date) : formatDate(pack.purchase_date)}
                  </td>
                  <td className="px-6 py-4">
                    <Badge className={pack.paid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>
                      {pack.paid ? 'Pagado' : 'Pendiente'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.packs.length === 0 && (
            <p className="px-6 py-10 text-sm text-muted">No hay suscripciones todavía.</p>
          )}
        </div>
      </Card>
    </AdminShell>
  )
}
