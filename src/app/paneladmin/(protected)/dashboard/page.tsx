import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getAdminDashboardData } from '@/lib/data/admin'
import { getLocale } from '@/lib/locale'
import { t } from '@/lib/i18n'
import { formatDate, formatDuration } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const identity = await requireAdmin()
  const data = await getAdminDashboardData()
  const locale = await getLocale()

  return (
    <AdminShell
      title={t(locale, 'dashboard.title')}
      description={t(locale, 'dashboard.description')}
      currentPath="/paneladmin/dashboard"
      userEmail={identity.email}
      locale={locale}
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: t(locale, 'dashboard.stat.activeClients'), value: data.activeClients.toString() },
          { label: t(locale, 'dashboard.stat.pendingTime'), value: formatDuration(data.pendingMinutes) },
          { label: t(locale, 'dashboard.stat.activePacks'), value: data.activePacks.toString() },
          { label: t(locale, 'dashboard.stat.monthActivities'), value: data.monthActivities.toString() },
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
              <h2 className="text-xl font-bold text-foreground">{t(locale, 'dashboard.recent.title')}</h2>
              <p className="text-sm text-muted">{t(locale, 'dashboard.recent.description')}</p>
            </div>
            <Badge>{t(locale, 'dashboard.recent.badge')}</Badge>
          </div>
          <div className="divide-y divide-line">
            {data.recentActivities.map((activity) => (
              <div key={activity.id} className="flex flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-foreground">{activity.title}</p>
                  <p className="text-sm text-muted">
                    {activity.clients?.name ?? t(locale, 'dashboard.recent.client')} · {activity.packs?.name ?? t(locale, 'dashboard.recent.pack')}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="font-semibold text-foreground">{formatDuration(activity.minutes_used)}</p>
                  <p className="text-sm text-muted">{formatDate(activity.work_date)}</p>
                </div>
              </div>
            ))}
            {data.recentActivities.length === 0 ? <p className="px-6 py-8 text-sm text-muted">{t(locale, 'dashboard.recent.empty')}</p> : null}
          </div>
        </Card>
      </section>
    </AdminShell>
  )
}
