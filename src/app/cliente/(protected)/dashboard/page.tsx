import { Card } from '@/components/ui/card'
import { requireClientAccess } from '@/lib/auth'
import { getClientDashboardData } from '@/lib/data/client'
import { getLocale } from '@/lib/locale'
import { t } from '@/lib/i18n'
import { formatDate, formatDuration } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ClientDashboardPage() {
  const identity = await requireClientAccess()
  const data = await getClientDashboardData(identity.email)
  const locale = await getLocale()

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">{t(locale, 'clientDashboard.eyebrow')}</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-foreground">{t(locale, 'clientDashboard.greeting')} {identity.client.name}</h1>
        <p className="mt-3 max-w-2xl text-muted">{t(locale, 'clientDashboard.summary')}</p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: t(locale, 'clientDashboard.stat.total'), value: formatDuration(data.summary?.total_minutes ?? 0) },
          { label: t(locale, 'clientDashboard.stat.used'), value: formatDuration(data.summary?.used_minutes ?? 0) },
          { label: t(locale, 'clientDashboard.stat.remaining'), value: formatDuration(data.summary?.remaining_minutes ?? 0) },
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
            <h2 className="text-xl font-bold text-foreground">{t(locale, 'clientDashboard.activity.title')}</h2>
            <p className="text-sm text-muted">{t(locale, 'clientDashboard.activity.description')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-6 py-4">{t(locale, 'clientDashboard.activity.col.date')}</th>
                  <th className="px-6 py-4">{t(locale, 'clientDashboard.activity.col.service')}</th>
                  <th className="px-6 py-4">{t(locale, 'clientDashboard.activity.col.description')}</th>
                  <th className="px-6 py-4">{t(locale, 'clientDashboard.activity.col.time')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.activities.map((activity) => (
                  <tr key={activity.id}>
                    <td className="px-6 py-4 text-slate-500">{formatDate(activity.work_date)}</td>
                    <td className="px-6 py-4 font-semibold text-foreground">{activity.title}</td>
                    <td className="px-6 py-4 text-slate-500">{activity.description || activity.activity_type}</td>
                    <td className="px-6 py-4 font-semibold text-foreground">{formatDuration(activity.minutes_used)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.activities.length === 0 ? <p className="px-6 py-8 text-sm text-muted">{t(locale, 'clientDashboard.activity.empty')}</p> : null}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-bold text-foreground">{t(locale, 'clientDashboard.notifications.title')}</h2>
          <p className="mt-2 text-sm text-muted">{t(locale, 'clientDashboard.notifications.description')}</p>
          <div className="mt-6 grid gap-4">
            {data.notifications.map((notification) => (
              <div key={notification.id} className="rounded-3xl border border-line bg-slate-50 p-4">
                <p className="font-semibold text-foreground">{notification.title}</p>
                <p className="mt-1 text-sm text-slate-500">{notification.body || t(locale, 'clientDashboard.notifications.default')}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  {notification.minutes_delta !== null ? <span className="font-semibold text-rose-600">{formatDuration(notification.minutes_delta)}</span> : null}
                  {notification.remaining_minutes !== null ? <span className="font-semibold text-brand">{t(locale, 'clientDashboard.notifications.remaining')} {formatDuration(notification.remaining_minutes)}</span> : null}
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.12em] text-slate-400">{formatDate(notification.created_at)}</p>
              </div>
            ))}
            {data.notifications.length === 0 ? <p className="text-sm text-muted">{t(locale, 'clientDashboard.notifications.empty')}</p> : null}
          </div>
        </Card>
      </section>
    </main>
  )
}
