import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ClientAccessManager } from '@/components/admin/client-access-manager'
import { ClientDetailNavigation, normalizeClientDetailView } from '@/components/admin/client-detail-navigation'
import { ClientForm } from '@/components/admin/client-form'
import { ClientMessageForm } from '@/components/admin/client-message-form'
import { SupportPreviewForm } from '@/components/admin/support-preview-form'
import { AdminShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth'
import { getAdminClientDetailPageData } from '@/lib/data/admin'
import { supportPreviewTranslations } from '@/lib/i18n'
import { getLocale } from '@/lib/locale'
import { formatDate, formatDuration } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-slate-300 px-5 py-8 text-sm text-muted">{children}</p>
}

export default async function AdminClientDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ view?: string; domain_q?: string }>
}) {
  const [identity, locale, { id }] = await Promise.all([requireAdmin(), getLocale(), params])
  const query: { view?: string; domain_q?: string } = searchParams ? await searchParams : {}
  const data = await getAdminClientDetailPageData(id)
  if (!data.client) notFound()

  const client = data.client
  const activeView = normalizeClientDetailView(query.view)
  const activePacks = data.activePacks ?? []
  const hourPacks = activePacks.filter((pack) => pack.pack_type === 'hours')
  const allDomainPacks = activePacks.filter((pack) => pack.pack_type === 'domain')
  const domainQuery = (query.domain_q ?? '').trim().toLowerCase()
  const domainPacks = allDomainPacks
    .filter((pack) => !domainQuery || pack.name.toLowerCase().includes(domainQuery))
    .sort((a, b) => (a.renewal_date ?? '9999').localeCompare(b.renewal_date ?? '9999'))
  const hostingPacks = activePacks.filter((pack) => pack.pack_type === 'hosting')
  const services = data.services ?? []
  const invoices = data.invoices ?? []
  const expenses = data.expenses ?? []
  const messages = data.messages ?? []
  const supportCopy = supportPreviewTranslations[locale]
  const supportDisabledReason = process.env.WF_SUPPORT_PREVIEW_ENABLED !== 'true'
    ? supportCopy.featureDisabled
    : client.status !== 'active' ? supportCopy.clientInactive : undefined
  const counts = {
    hours: hourPacks.length, domains: allDomainPacks.length, hosting: hostingPacks.length,
    services: services.length, invoices: invoices.length, expenses: expenses.length,
    messages: messages.length, history: data.packs.length,
  }

  const packList = (title: string, items: typeof activePacks, searchable = false) => (
    <Card className="overflow-hidden">
      <div className="border-b border-line p-6">
        <h2 className="text-xl font-bold">{title}</h2>
        {searchable ? (
          <form className="mt-4 flex gap-2">
            <input type="hidden" name="view" value="domains" />
            <input className="h-10 min-w-0 flex-1 rounded-full border border-line px-4 text-sm" type="search" name="domain_q" defaultValue={query.domain_q ?? ''} placeholder="Buscar dominio…" />
            <button className="rounded-full bg-slate-900 px-4 text-sm font-semibold text-white">Buscar</button>
          </form>
        ) : null}
      </div>
      <div className="divide-y divide-line">
        {items.map((pack) => (
          <article key={pack.id} className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{pack.name}</h3><Badge className="bg-slate-100 text-slate-700">{pack.status}</Badge></div>
            <div className="mt-2 grid gap-1 text-sm text-muted sm:grid-cols-2">
              {pack.pack_type === 'hours' ? <p>Disponible: {formatDuration(pack.minutes_total ?? 0)}</p> : null}
              <p>Alta: {formatDate(pack.purchase_date)}</p>
              {pack.renewal_date ? <p>Renueva/caduca: {formatDate(pack.renewal_date)}</p> : null}
              <p>Precio: {pack.price !== null ? `${pack.price} €` : '—'}</p>
            </div>
          </article>
        ))}
        {!items.length ? <div className="p-6"><Empty>Sin elementos registrados.</Empty></div> : null}
      </div>
    </Card>
  )

  let content: React.ReactNode
  if (activeView === 'profile') content = <ClientForm editingClient={client} locale={locale} />
  else if (activeView === 'access') content = <ClientAccessManager clientId={client.id} clientName={client.name} accessStatus={data.accessStatus} />
  else if (activeView === 'hours') content = packList('Bonos de horas', hourPacks)
  else if (activeView === 'domains') content = packList('Dominios', domainPacks, true)
  else if (activeView === 'hosting') content = packList('Hosting', hostingPacks)
  else if (activeView === 'services') content = (
    <Card className="p-6"><h2 className="text-xl font-bold">Servicios registrados</h2><div className="mt-4 space-y-3">{services.map((service) => <article key={service.id} className="rounded-2xl border border-line p-4"><h3 className="font-semibold">{service.name}</h3><p className="mt-1 text-sm text-muted">{service.service_type} · {service.price !== null ? `${service.price} €` : 'Sin precio'} · {service.status}</p></article>)}{!services.length ? <Empty>Sin servicios registrados.</Empty> : null}</div></Card>
  )
  else if (activeView === 'invoices') content = (
    <Card className="p-6"><h2 className="text-xl font-bold">Facturas y propuestas</h2><div className="mt-4 space-y-3">{invoices.map((invoice) => <Link key={invoice.id} href={`/paneladmin/facturas/${invoice.id}/print`} target="_blank" className="block rounded-2xl border border-line p-4 hover:bg-slate-50"><h3 className="font-semibold">{invoice.number} · {invoice.concept}</h3><p className="mt-1 text-sm text-muted">{formatDate(invoice.issued_at)} · {Number(invoice.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p></Link>)}{!invoices.length ? <Empty>Sin documentos emitidos.</Empty> : null}</div></Card>
  )
  else if (activeView === 'expenses') content = (
    <Card className="p-6"><h2 className="text-xl font-bold">Gastos relacionados</h2><div className="mt-4 space-y-3">{expenses.map((expense) => <article key={expense.id} className="rounded-2xl border border-line p-4"><h3 className="font-semibold">{expense.supplier || 'Sin proveedor'} · {expense.concept}</h3><p className="mt-1 text-sm text-muted">{formatDate(expense.expense_date)} · {Number(expense.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p></article>)}{!expenses.length ? <Empty>Sin gastos relacionados.</Empty> : null}</div></Card>
  )
  else if (activeView === 'messages') content = (
    <Card className="p-6"><p className="text-xs font-semibold uppercase tracking-wider text-brand">COMUNICACIÓN</p><div id="mensajes"><h2 className="mt-2 text-xl font-bold">Mensajes con el cliente</h2><div className="mt-4"><ClientMessageForm clientId={client.id} /></div><div className="mt-5 space-y-3">{messages.map((message) => <article key={message.id} className="rounded-2xl border border-line p-4"><h3 className="font-semibold">{message.subject}</h3><p className="mt-2 text-sm text-muted">{message.body}</p></article>)}{!messages.length ? <Empty>Todavía no hay mensajes.</Empty> : null}</div></div></Card>
  )
  else if (activeView === 'history') content = packList('Historial contratado', data.packs)
  else content = (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[
        ['Bonos activos', hourPacks.length, 'hours'], ['Dominios', allDomainPacks.length, 'domains'], ['Hosting', hostingPacks.length, 'hosting'],
        ['Servicios', services.length, 'services'], ['Facturas', invoices.length, 'invoices'], ['Mensajes', messages.length, 'messages'],
      ].map(([label, count, view]) => <Link key={String(view)} href={`/paneladmin/clientes/${client.id}?view=${view}`} className="rounded-2xl border border-line bg-white p-5 shadow-sm hover:border-brand"><p className="text-sm font-semibold text-muted">{label}</p><p className="mt-2 text-3xl font-black">{count}</p></Link>)}
    </div>
  )

  return (
    <AdminShell title={client.name} description={client.company || 'Ficha completa del cliente'} currentPath="/paneladmin/clientes" userEmail={identity.email} locale={locale}>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href="/paneladmin/clientes" className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">← Clientes</Link>
        <Badge className={client.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}>{client.status}</Badge>
        <SupportPreviewForm clientId={client.id} clientName={client.name} returnPath={`/paneladmin/clientes/${client.id}?view=${activeView}`} disabledReason={supportDisabledReason} locale={locale} />
      </div>
      <Card className="mb-6 p-4"><div className="flex flex-wrap gap-2">{[
        ['Crear factura', `/paneladmin/facturas?new=1&client=${client.id}`], ['Añadir servicio', `/paneladmin/servicios?new=1&client=${client.id}`],
        ['Añadir dominio', `/paneladmin/bonos?new=1&tab=dominios&client=${client.id}`], ['Enviar mensaje', `/paneladmin/clientes/${client.id}?view=messages`],
      ].map(([label, href]) => <Link key={href} href={href} className="rounded-full bg-brand/10 px-4 py-2 text-sm font-semibold text-brand">{label}</Link>)}</div></Card>
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <ClientDetailNavigation clientId={client.id} activeView={activeView} counts={counts} />
        <main>{content}</main>
      </div>
    </AdminShell>
  )
}
