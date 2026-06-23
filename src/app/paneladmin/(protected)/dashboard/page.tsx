import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getAdminDashboardData } from '@/lib/data/admin'
import { formatDate, formatDuration } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const identity = await requireAdmin()
  const data = await getAdminDashboardData()

  return (
    <AdminShell title="Dashboard" description="Visión rápida del estado de clientes, packs y actividad mensual." currentPath="/paneladmin/dashboard" userEmail={identity.email}>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Clientes activos', value: data.activeClients.toString() },
          { label: 'Tiempo pendiente', value: formatDuration(data.pendingMinutes) },
          { label: 'Bonos activos', value: data.activePacks.toString() },
          { label: 'Actividades este mes', value: data.monthActivities.toString() },
        ].map((item) => (
          <Card key={item.label} className="p-6">
            <p className="text-sm text-muted">{item.label}</p>
            <p className="mt-4 text-3xl font-black tracking-tight text-foreground">{item.value}</p>
          </Card>
        ))}
      </section>

      <section className="mt-8">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-6 py-5">
            <div>
              <h2 className="text-xl font-bold text-foreground">Actividad reciente</h2>
              <p className="text-sm text-muted">Últimos movimientos registrados por el equipo.</p>
            </div>
            <Badge>En tiempo real</Badge>
          </div>
          <div className="divide-y divide-line">
            {data.recentActivities.map((activity) => (
              <div key={activity.id} className="flex flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-foreground">{activity.title}</p>
                  <p className="text-sm text-muted">
                    {activity.clients?.name ?? 'Cliente'} · {activity.packs?.name ?? 'Pack'}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="font-semibold text-foreground">{formatDuration(activity.minutes_used)}</p>
                  <p className="text-sm text-muted">{formatDate(activity.work_date)}</p>
                </div>
              </div>
            ))}
            {data.recentActivities.length === 0 ? <p className="px-6 py-8 text-sm text-muted">Todavía no hay actividad registrada.</p> : null}
          </div>
        </Card>
      </section>
    </AdminShell>
  )
}
