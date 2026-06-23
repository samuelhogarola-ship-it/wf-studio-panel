import { ActivityForm } from '@/components/admin/activity-form'
import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getAdminActivitiesPageData } from '@/lib/data/admin'
import { getLocale } from '@/lib/locale'
import { t } from '@/lib/i18n'
import { formatDate, formatDuration } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AdminActivitiesPage() {
  const identity = await requireAdmin()
  const data = await getAdminActivitiesPageData()
  const locale = await getLocale()

  return (
    <AdminShell
      title={t(locale, 'activities.title')}
      description={t(locale, 'activities.description')}
      currentPath="/paneladmin/actividades"
      userEmail={identity.email}
      locale={locale}
    >
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <ActivityForm clients={data.clients} packs={data.packs} locale={locale} />

        <Card className="overflow-hidden">
          <div className="border-b border-line px-6 py-5">
            <h2 className="text-xl font-bold text-foreground">{t(locale, 'activities.list.title')}</h2>
            <p className="text-sm text-muted">{t(locale, 'activities.list.description')}</p>
          </div>
          <div className="divide-y divide-line">
            {data.activities.map((activity) => (
              <div key={activity.id} className="px-6 py-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{activity.title}</p>
                    <p className="text-sm text-slate-500">
                      {activity.clients?.name ?? t(locale, 'activities.list.client')} · {activity.packs?.name ?? t(locale, 'activities.list.pack')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{activity.activity_type}</Badge>
                    {activity.notify_client ? <Badge className="bg-brandSoft text-brand">email</Badge> : null}
                    <span className="font-semibold text-foreground">{formatDuration(activity.minutes_used)}</span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted">{formatDate(activity.work_date)}</p>
              </div>
            ))}
            {data.activities.length === 0 ? <p className="px-6 py-8 text-sm text-muted">{t(locale, 'activities.list.empty')}</p> : null}
          </div>
        </Card>
      </div>
    </AdminShell>
  )
}
