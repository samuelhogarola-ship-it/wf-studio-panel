import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getAdminClientDetailPageData } from '@/lib/data/admin'
import { t } from '@/lib/i18n'
import { getLocale } from '@/lib/locale'
import { formatDate, formatDuration } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const PACK_TYPE_LABELS: Record<string, string> = {
  hours: 'Bono de horas',
  tasks: 'Pack cerrado',
  domain: 'Dominio',
  hosting: 'Hosting',
  service: 'Servicio',
  subscription: 'Suscripción',
  membership: 'Membresía',
}

export default async function AdminClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await requireAdmin()
  const locale = await getLocale()
  const { id } = await params
  const data = await getAdminClientDetailPageData(id)

  if (!data.client) {
    notFound()
  }

  return (
    <AdminShell
      title={data.client.name}
      description={t(locale, 'clientDetail.description')}
      currentPath="/paneladmin/clientes"
      userEmail={identity.email}
      locale={locale}
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href="/paneladmin/clientes" className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
          {t(locale, 'clientDetail.back')}
        </Link>
        <Badge className={data.client.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
          {data.client.status}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{t(locale, 'clientDetail.profile')}</p>
            <h2 className="mt-2 text-xl font-bold text-foreground">{data.client.name}</h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <p><span className="font-semibold text-foreground">{t(locale, 'clientDetail.email')}</span> {data.client.email}</p>
              <p><span className="font-semibold text-foreground">{t(locale, 'clientDetail.company')}</span> {data.client.company || '—'}</p>
              <p><span className="font-semibold text-foreground">{t(locale, 'clientDetail.phone')}</span> {data.client.phone || '—'}</p>
              <p><span className="font-semibold text-foreground">{t(locale, 'clientDetail.created')}</span> {formatDate(data.client.created_at)}</p>
            </div>
          </Card>

          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{t(locale, 'clientDetail.summary')}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-line bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t(locale, 'clientDetail.total')}</p>
                <p className="mt-2 text-xl font-bold text-foreground">{formatDuration(data.summary?.total_minutes ?? 0)}</p>
              </div>
              <div className="rounded-3xl border border-line bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t(locale, 'clientDetail.used')}</p>
                <p className="mt-2 text-xl font-bold text-foreground">{formatDuration(data.summary?.used_minutes ?? 0)}</p>
              </div>
              <div className="rounded-3xl border border-line bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t(locale, 'clientDetail.remaining')}</p>
                <p className="mt-2 text-xl font-bold text-foreground">{formatDuration(data.summary?.remaining_minutes ?? 0)}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="border-b border-line px-6 py-5">
              <h2 className="text-xl font-bold text-foreground">{t(locale, 'clientDetail.activePacks')}</h2>
              <p className="text-sm text-muted">{t(locale, 'clientDetail.activePacksDescription')}</p>
            </div>
            <div className="divide-y divide-line">
              {data.activePacks.map((pack) => (
                <div key={pack.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{pack.name}</p>
                    <Badge className={pack.pack_type === 'tasks' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}>
                      {PACK_TYPE_LABELS[pack.pack_type] ?? pack.pack_type}
                    </Badge>
                  </div>
                  <div className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <p><span className="font-semibold text-foreground">{t(locale, 'clientDetail.total')}</span> {formatDuration(pack.minutes_total)}</p>
                    <p><span className="font-semibold text-foreground">{t(locale, 'clientDetail.purchaseDate')}</span> {formatDate(pack.purchase_date)}</p>
                    <p><span className="font-semibold text-foreground">{t(locale, 'clientDetail.invoice')}</span> {pack.invoice_number || '—'}</p>
                    <p><span className="font-semibold text-foreground">{t(locale, 'clientDetail.price')}</span> {pack.price !== null ? `${pack.price} €` : '—'}</p>
                  </div>
                  {pack.notes ? <p className="mt-3 text-sm text-muted">{pack.notes}</p> : null}
                </div>
              ))}
              {data.activePacks.length === 0 ? <p className="px-6 py-8 text-sm text-muted">{t(locale, 'clientDetail.activePacksEmpty')}</p> : null}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-line px-6 py-5">
              <h2 className="text-xl font-bold text-foreground">{t(locale, 'clientDetail.recentActivity')}</h2>
            </div>
            <div className="divide-y divide-line">
              {data.recentActivities.map((activity) => (
                <div key={activity.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{activity.title}</p>
                      <p className="text-sm text-slate-500">
                        {activity.packs?.name ?? t(locale, 'activities.list.pack')} · {activity.activity_type}
                      </p>
                    </div>
                    <span className="font-semibold text-foreground">{formatDuration(activity.minutes_used)}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted">{formatDate(activity.work_date)}</p>
                </div>
              ))}
              {data.recentActivities.length === 0 ? <p className="px-6 py-8 text-sm text-muted">{t(locale, 'clientDetail.recentActivityEmpty')}</p> : null}
            </div>
          </Card>
        </div>
      </div>
    </AdminShell>
  )
}
