import Link from 'next/link'
import { notFound } from 'next/navigation'

import { deletePendingItemAction, togglePendingItemStatusAction } from '@/lib/actions/admin'
import { PendingItemForm } from '@/components/admin/pending-item-form'
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

const PACK_TYPE_BADGE_CLASSES: Record<string, string> = {
  hours: 'bg-sky-50 text-sky-700',
  tasks: 'bg-amber-50 text-amber-700',
  domain: 'bg-violet-50 text-violet-700',
  hosting: 'bg-emerald-50 text-emerald-700',
  service: 'bg-slate-100 text-slate-700',
  subscription: 'bg-indigo-50 text-indigo-700',
  membership: 'bg-fuchsia-50 text-fuchsia-700',
}

function getPendingStatusMeta(status: string) {
  if (status === 'received') {
    return { label: 'Recibido', className: 'bg-emerald-50 text-emerald-700' }
  }

  return { label: 'Pendiente', className: 'bg-amber-50 text-amber-700' }
}

export default async function AdminClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await requireAdmin()
  const locale = await getLocale()
  const { id } = await params
  const data = await getAdminClientDetailPageData(id)

  if (!data.client) {
    notFound()
  }

  const client = data.client
  const activePacks = data.activePacks
  const hourPacks = activePacks.filter((pack) => pack.pack_type === 'hours')
  const domainPacks = activePacks.filter((pack) => pack.pack_type === 'domain')
  const hostingPacks = activePacks.filter((pack) => pack.pack_type === 'hosting')
  const servicePacks = activePacks.filter((pack) => !['hours', 'domain', 'hosting'].includes(pack.pack_type))

  const contractSections = [
    { id: 'bonos-horas', label: 'Bonos de horas', count: hourPacks.length },
    { id: 'dominios', label: 'Dominios', count: domainPacks.length },
    { id: 'hosting', label: 'Hosting', count: hostingPacks.length },
    { id: 'packs-servicios', label: 'Packs y servicios', count: servicePacks.length },
    { id: 'historial-contratado', label: 'Historial contratado', count: data.packs.length },
  ]

  function renderPackMeta(pack: (typeof activePacks)[number]) {
    const isHours = pack.pack_type === 'hours'
    const isRenewable = ['domain', 'hosting', 'service', 'subscription', 'membership'].includes(pack.pack_type)

    return (
      <div className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
        {isHours ? (
          <p><span className="font-semibold text-foreground">Horas:</span> {formatDuration(pack.minutes_total ?? 0)}</p>
        ) : null}
        <p><span className="font-semibold text-foreground">{t(locale, 'clientDetail.purchaseDate')}</span> {formatDate(pack.purchase_date)}</p>
        {isRenewable && pack.renewal_date ? (
          <p><span className="font-semibold text-foreground">{pack.pack_type === 'domain' || pack.pack_type === 'hosting' ? 'Caduca:' : 'Renueva:'}</span> {formatDate(pack.renewal_date)}</p>
        ) : null}
        {pack.billing_cycle ? (
          <p><span className="font-semibold text-foreground">Ciclo:</span> {pack.billing_cycle}</p>
        ) : null}
        <p><span className="font-semibold text-foreground">{t(locale, 'clientDetail.invoice')}</span> {pack.invoice_number || '—'}</p>
        <p><span className="font-semibold text-foreground">{t(locale, 'clientDetail.price')}</span> {pack.price !== null ? `${pack.price} €` : '—'}</p>
        {pack.paid !== null ? (
          <p><span className="font-semibold text-foreground">Pago:</span> {pack.paid ? 'Pagado' : 'Pendiente'}</p>
        ) : null}
      </div>
    )
  }

  function renderContractSection(title: string, description: string, items: typeof activePacks, id: string) {
    return (
      <section id={id} className="scroll-mt-24">
        <div className="border-b border-line px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-foreground">{title}</h2>
              <p className="text-sm text-muted">{description}</p>
            </div>
            <Badge className="bg-slate-100 text-slate-700">{items.length} activos</Badge>
          </div>
        </div>
        <div className="divide-y divide-line">
          {items.map((pack) => (
            <div key={pack.id} className="px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-foreground">{pack.name}</p>
                <Badge className={PACK_TYPE_BADGE_CLASSES[pack.pack_type] ?? 'bg-slate-100 text-slate-700'}>
                  {PACK_TYPE_LABELS[pack.pack_type] ?? pack.pack_type}
                </Badge>
                {pack.paid === false ? <Badge className="bg-amber-50 text-amber-700">Pendiente de pago</Badge> : null}
              </div>
              {renderPackMeta(pack)}
              {pack.notes ? <p className="mt-3 text-sm text-muted">{pack.notes}</p> : null}
            </div>
          ))}
          {items.length === 0 ? <p className="px-6 py-8 text-sm text-muted">{t(locale, 'clientDetail.empty')}</p> : null}
        </div>
      </section>
    )
  }

  return (
    <AdminShell
      title={client.name}
      description={t(locale, 'clientDetail.description')}
      currentPath="/paneladmin/clientes"
      userEmail={identity.email}
      locale={locale}
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href="/paneladmin/clientes" className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
          {t(locale, 'clientDetail.back')}
        </Link>
        <Badge className={client.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
          {client.status}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{t(locale, 'clientDetail.profile')}</p>
            <h2 className="mt-2 text-xl font-bold text-foreground">{client.name}</h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <p><span className="font-semibold text-foreground">{t(locale, 'clientDetail.email')}</span> {client.email}</p>
              <p><span className="font-semibold text-foreground">{t(locale, 'clientDetail.company')}</span> {client.company || '—'}</p>
              <p><span className="font-semibold text-foreground">{t(locale, 'clientDetail.phone')}</span> {client.phone || '—'}</p>
              <p><span className="font-semibold text-foreground">{t(locale, 'clientDetail.created')}</span> {formatDate(client.created_at)}</p>
            </div>
          </Card>

          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Contratación</p>
            <h2 className="mt-2 text-xl font-bold text-foreground">Menú de servicios del cliente</h2>
            <p className="mt-1 text-sm text-slate-500">Separado por tipo para no mezclar bonos de horas con dominios, hosting o packs.</p>
            <div className="mt-4 grid gap-2">
              {contractSections.map((section) => (
                <a key={section.id} href={`#${section.id}`} className="flex items-center justify-between rounded-2xl border border-line bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white">
                  <span>{section.label}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-500">{section.count}</span>
                </a>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Checklist cliente</p>
                <h2 className="mt-2 text-xl font-bold text-foreground">Pendientes por recibir</h2>
                <p className="mt-1 text-sm text-slate-500">Datos, accesos o materiales que el cliente todavía tiene que enviarte.</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {data.pendingItems.filter((item) => item.status === 'pending').length} pendientes
              </div>
            </div>

            <PendingItemForm clientId={client.id} />

            <div className="mt-5 space-y-3">
              {data.pendingItems.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-400">
                  Todavía no has añadido pendientes para este cliente.
                </p>
              ) : (
                data.pendingItems.map((item) => {
                  const statusMeta = getPendingStatusMeta(item.status)

                  return (
                    <div key={item.id} className="rounded-2xl border border-line bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-foreground">{item.title}</p>
                            <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            Solicitado el {formatDate(item.requested_at)}
                            {item.received_at ? ` · recibido el ${formatDate(item.received_at)}` : ''}
                          </p>
                          {item.reminder_interval_days ? (
                            <p className="mt-1 text-xs text-slate-500">
                              Recordatorio cada {item.reminder_interval_days === 1 ? 'día' : `${item.reminder_interval_days} días`}
                              {item.next_reminder_at ? ` · próximo envío ${formatDate(item.next_reminder_at)}` : ''}
                            </p>
                          ) : null}
                          {item.description ? <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.description}</p> : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <form action={togglePendingItemStatusAction}>
                            <input type="hidden" name="item_id" value={item.id} />
                            <input type="hidden" name="client_id" value={client.id} />
                            <input type="hidden" name="status" value={item.status} />
                            <button className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition">
                              {item.status === 'pending' ? 'Marcar recibido' : 'Reabrir'}
                            </button>
                          </form>
                          <form action={deletePendingItemAction}>
                            <input type="hidden" name="item_id" value={item.id} />
                            <input type="hidden" name="client_id" value={client.id} />
                            <button className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition">
                              Borrar
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            {renderContractSection('Bonos de horas', 'Solo bonos que descuentan tiempo de trabajo.', hourPacks, 'bonos-horas')}
            {renderContractSection('Dominios', 'Registros o renovaciones de dominio contratados.', domainPacks, 'dominios')}
            {renderContractSection('Hosting', 'Alojamientos, mantenimiento técnico o cuotas de hosting.', hostingPacks, 'hosting')}
            {renderContractSection('Packs y servicios', 'Packs cerrados, servicios, suscripciones o membresías activas.', servicePacks, 'packs-servicios')}
          </Card>

          <Card id="historial-contratado" className="scroll-mt-24 overflow-hidden">
            <div className="border-b border-line px-6 py-5">
              <h2 className="text-xl font-bold text-foreground">Historial contratado</h2>
              <p className="text-sm text-muted">Todo lo que ha tenido contratado este cliente, activo o no.</p>
            </div>
            <div className="divide-y divide-line">
              {data.packs.map((pack) => (
                <div key={pack.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{pack.name}</p>
                    <Badge className={PACK_TYPE_BADGE_CLASSES[pack.pack_type] ?? 'bg-slate-100 text-slate-700'}>
                      {PACK_TYPE_LABELS[pack.pack_type] ?? pack.pack_type}
                    </Badge>
                    <Badge className={pack.status === 'active' ? 'bg-emerald-50 text-emerald-700' : pack.status === 'completed' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}>
                      {pack.status === 'completed' ? 'Completado' : pack.status}
                    </Badge>
                  </div>
                  {renderPackMeta(pack)}
                  {pack.notes ? <p className="mt-3 text-sm text-muted">{pack.notes}</p> : null}
                </div>
              ))}
              {data.packs.length === 0 ? <p className="px-6 py-8 text-sm text-muted">Sin historial contratado.</p> : null}
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
