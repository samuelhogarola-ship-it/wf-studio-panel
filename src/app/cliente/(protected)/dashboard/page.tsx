import { Card } from '@/components/ui/card'
import { requireClientAccess } from '@/lib/auth'
import { getClientDashboardData } from '@/lib/data/client'
import { formatDate, formatHours } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ClientDashboardPage() {
  const identity = await requireClientAccess()
  const data = await getClientDashboardData(identity.email)

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Portal cliente</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-foreground">Hola, {identity.client.name}</h1>
        <p className="mt-3 max-w-2xl text-muted">Aquí tienes tu resumen actualizado de horas contratadas, consumo y trabajos registrados.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Horas contratadas', value: formatHours(data.summary?.total_hours ?? 0) },
          { label: 'Horas consumidas', value: formatHours(data.summary?.used_hours ?? 0) },
          { label: 'Horas restantes', value: formatHours(data.summary?.remaining_hours ?? 0) },
        ].map((item) => (
          <Card key={item.label} className="p-6">
            <p className="text-sm text-muted">{item.label}</p>
            <p className="mt-4 text-3xl font-black tracking-tight text-foreground">{item.value}</p>
          </Card>
        ))}
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-6 py-5">
            <h2 className="text-xl font-bold text-foreground">Historial de actividad</h2>
            <p className="text-sm text-muted">Ordenado de la más reciente a la más antigua.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Servicio</th>
                  <th className="px-6 py-4">Descripción</th>
                  <th className="px-6 py-4">Tiempo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.activities.map((activity) => (
                  <tr key={activity.id}>
                    <td className="px-6 py-4 text-slate-500">{formatDate(activity.work_date)}</td>
                    <td className="px-6 py-4 font-semibold text-foreground">{activity.title}</td>
                    <td className="px-6 py-4 text-slate-500">{activity.description || activity.activity_type}</td>
                    <td className="px-6 py-4 font-semibold text-foreground">{formatHours(activity.hours_used)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.activities.length === 0 ? <p className="px-6 py-8 text-sm text-muted">Aún no hay actividades registradas para tu cuenta.</p> : null}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-bold text-foreground">Notificaciones</h2>
          <p className="mt-2 text-sm text-muted">Avisos internos generados a partir de nuevas actividades y actualizaciones de servicio.</p>
          <div className="mt-6 grid gap-4">
            {data.notifications.map((notification) => (
              <div key={notification.id} className="rounded-3xl border border-line bg-slate-50 p-4">
                <p className="font-semibold text-foreground">{notification.title}</p>
                <p className="mt-1 text-sm text-slate-500">{notification.body || 'Actividad registrada'}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  {notification.hours_delta !== null ? <span className="font-semibold text-rose-600">{formatHours(notification.hours_delta)}</span> : null}
                  {notification.remaining_hours !== null ? <span className="font-semibold text-brand">Horas restantes: {formatHours(notification.remaining_hours)}</span> : null}
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.12em] text-slate-400">{formatDate(notification.created_at)}</p>
              </div>
            ))}
            {data.notifications.length === 0 ? <p className="text-sm text-muted">No hay notificaciones disponibles todavía.</p> : null}
          </div>
        </Card>
      </section>
    </main>
  )
}
