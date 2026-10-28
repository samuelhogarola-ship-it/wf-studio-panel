import Link from 'next/link'
import { notFound } from 'next/navigation'

import { deletePendingItemAction, togglePendingItemStatusAction } from '@/lib/actions/admin'
import { ClientForm } from '@/components/admin/client-form'
import { ClientMessageForm } from '@/components/admin/client-message-form'
import { PendingItemForm } from '@/components/admin/pending-item-form'
import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { SupportPreviewForm } from '@/components/admin/support-preview-form'
import { requireAdmin } from '@/lib/auth'
import { getAdminClientDetailPageData } from '@/lib/data/admin'
import { supportPreviewTranslations, t } from '@/lib/i18n'
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

export default async function AdminClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ domain_q?: string }>
}) {
  const identity = await requireAdmin()
  const locale = await getLocale()
  const { id } = await params
  const query = searchParams ? await searchParams : {}
  const data = await getAdminClientDetailPageData(id)

  if (!data.client) {
    notFound()
  }

  const client = data.client
  const services = data.services ?? []
  const invoices = data.invoices ?? []
  const expenses = data.expenses ?? []
  const supportCopy = supportPreviewTranslations[locale]
  const supportDisabledReason = process.env.WF_SUPPORT_PREVIEW_ENABLED !== 'true'
    ? supportCopy.featureDisabled
    : client.status !== 'active' ? supportCopy.clientInactive : undefined
  const activePacks = data.activePacks
  const hourPacks = activePacks.filter((pack) => pack.pack_type === 'hours')
  const allDomainPacks = activePacks.filter((pack) => pack.pack_type === 'domain')
  const domainQuery = (query.domain_q ?? '').trim().toLowerCase()
  const domainPacks = allDomainPacks
    .filter((pack) => !domainQuery || pack.name.toLowerCase().includes(domainQuery))
    .sort((left, right) => {
      if (!left.renewal_date) return 1
      if (!right.renewal_date) return -1
      return left.renewal_date.localeCompare(right.renewal_date)
    })
  const hostingPacks = activePacks.filter((pack) => pack.pack_type === 'hosting')
  const servicePacks = activePacks.filter((pack) => !['hours', 'domain', 'hosting'].includes(pack.pack_type))
  const contractSections = [
    { id: 'bonos-horas', label: 'Bonos de horas', count: hourPacks.length },
    { id: 'dominios', label: 'Dominios', count: allDomainPacks.length },
    { id: 'hosting', label: 'Hosting', count: hostingPacks.length },
    { id: 'packs-servicios', label: 'Packs y servicios', count: servicePacks.length },
    { id: 'servicios-activos', label: 'Servicios', count: services.length },
    { id: 'facturas-cliente', label: 'Facturas y propuestas', count: invoices.length },
    { id: 'gastos-cliente', label: 'Gastos', count: expenses.length },
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

  function renderContractSection(title: string, description: string, items: typeof activePacks, id: string, searchable = false) {
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
          {searchable ? (
            <form action={`/paneladmin/clientes/${client.id}`} className="mt-4 flex gap-2">
              <input
                type="search"
                name="domain_q"
                defaultValue={query.domain_q ?? ''}
                placeholder="Buscar dominio…"
                className="h-10 min-w-0 flex-1 rounded-full border border-line bg-white px-4 text-sm text-foreground outline-none focus:border-brand"
              />
              <button className="rounded-full bg-slate-100 px-4 text-sm font-semibold text-slate-700">Buscar</button>
            </form>
          ) : null}
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
        <SupportPreviewForm
          clientId={client.id}
          clientName={client.name}
          returnPath={`/paneladmin/clientes/${client.id}`}
          disabledReason={supportDisabledReason}
          locale={locale}
        />
      </div>

      <Card className="mb-6 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Acciones del cliente</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { label: 'Crear factura', href: `/paneladmin/facturas?new=1&client=${client.id}` },
            { label: 'Crear gasto', href: `/paneladmin/gastos?new=1&client=${client.id}` },
            { label: 'Añadir servicio', href: `/paneladmin/servicios?new=1&client=${client.id}` },
            { label: 'Añadir bono', href: `/paneladmin/bonos?new=1&tab=horas&client=${client.id}` },
            { label: 'Añadir dominio', href: `/paneladmin/bonos?new=1&tab=dominios&client=${client.id}` },
            { label: 'Enviar mensaje', href: `/paneladmin/clientes/${client.id}#mensajes` },
          ].map((action) => (
            <Link key={action.label} href={action.href} className="rounded-full bg-brand/10 px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/20">
              {action.label}
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <div id="perfil" className="scroll-mt-24">
            <ClientForm editingClient={client} locale={locale} />
          </div>

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

          <Card id="mensajes" className="scroll-mt-24 p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Comunicación</p>
                <h2 className="mt-2 text-xl font-bold text-foreground">Mensajes con el cliente</h2>
                <p className="mt-1 text-sm text-slate-500">Mensajes visibles en el portal del cliente.</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {data.messages.length} mensajes
              </div>
            </div>

            <ClientMessageForm clientId={client.id} />

            <div className="mt-5 space-y-3">
              {data.messages.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-400">
                  Todavía no hay mensajes con este cliente.
                </p>
              ) : (
                data.messages.map((message) => {
                  const isFromClient = message.direction === 'outbound'

                  return (
                    <div key={message.id} className={`rounded-2xl border p-4 ${isFromClient ? 'border-amber-100 bg-amber-50/60' : 'border-line bg-white'}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-foreground">{message.subject}</p>
                            <Badge className={isFromClient ? 'bg-amber-100 text-amber-700' : 'bg-sky-50 text-sky-700'}>
                              {isFromClient ? 'Cliente' : 'Studio'}
                            </Badge>
                            {message.type !== 'message' ? <Badge className="bg-slate-100 text-slate-600">{message.type}</Badge> : null}
                          </div>
                          <p className="mt-1 text-xs text-slate-400">{formatDate(message.created_at)}</p>
                          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">{message.body}</p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
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
            {renderContractSection('Dominios', 'Registros o renovaciones de dominio contratados, ordenados por próxima caducidad.', domainPacks, 'dominios', true)}
            {renderContractSection('Hosting', 'Alojamientos, mantenimiento técnico o cuotas de hosting.', hostingPacks, 'hosting')}
            {renderContractSection('Packs y servicios', 'Packs cerrados, servicios, suscripciones o membresías activas.', servicePacks, 'packs-servicios')}
          </Card>

          <Card id="servicios-activos" className="scroll-mt-24 overflow-hidden">
            <div className="border-b border-line px-6 py-5">
              <h2 className="text-xl font-bold text-foreground">Servicios activos</h2>
              <p className="text-sm text-muted">Servicios registrados directamente para este cliente.</p>
            </div>
            <div className="divide-y divide-line">
              {services.map((service) => (
                <div key={service.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">{service.name}</p>
                    <Badge className={service.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}>{service.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{service.service_type} · {formatDate(service.service_date)} · {service.price !== null ? `${service.price} €` : 'Sin precio'}</p>
                  {service.notes ? <p className="mt-2 text-sm text-muted">{service.notes}</p> : null}
                </div>
              ))}
              {services.length === 0 ? <p className="px-6 py-8 text-sm text-muted">Sin servicios registrados.</p> : null}
            </div>
          </Card>

          <Card id="facturas-cliente" className="scroll-mt-24 overflow-hidden">
            <div className="border-b border-line px-6 py-5">
              <h2 className="text-xl font-bold text-foreground">Facturas y propuestas</h2>
              <p className="text-sm text-muted">Documentos emitidos desde Bill-in para este cliente.</p>
            </div>
            <div className="divide-y divide-line">
              {invoices.map((invoice) => (
                <Link key={invoice.id} href={`/paneladmin/facturas/${invoice.id}/print`} target="_blank" className="block px-6 py-5 transition hover:bg-slate-50">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-foreground">{invoice.number} · {invoice.concept}</p><Badge className={invoice.document_type === 'proposal' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}>{invoice.document_type === 'proposal' ? 'Propuesta' : 'Factura'}</Badge></div>
                  <p className="mt-2 text-sm text-slate-500">{formatDate(invoice.issued_at)} · {Number(invoice.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} · {invoice.status}</p>
                </Link>
              ))}
              {invoices.length === 0 ? <p className="px-6 py-8 text-sm text-muted">Sin documentos emitidos.</p> : null}
            </div>
          </Card>

          <Card id="gastos-cliente" className="scroll-mt-24 overflow-hidden">
            <div className="border-b border-line px-6 py-5">
              <h2 className="text-xl font-bold text-foreground">Gastos relacionados</h2>
              <p className="text-sm text-muted">Gastos de Bill-in vinculados a este cliente.</p>
            </div>
            <div className="divide-y divide-line">
              {expenses.map((expense) => (
                <div key={expense.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-foreground">{expense.supplier} · {expense.concept}</p><Badge className={expense.accounting_area === 'classes' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-700'}>{expense.accounting_area === 'classes' ? 'Clases' : 'General'}</Badge></div>
                  <p className="mt-2 text-sm text-slate-500">{formatDate(expense.expense_date)} · {Number(expense.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} · {expense.status}</p>
                </div>
              ))}
              {expenses.length === 0 ? <p className="px-6 py-8 text-sm text-muted">Sin gastos relacionados.</p> : null}
            </div>
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
