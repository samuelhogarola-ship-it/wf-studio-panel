import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getAccessibleClientProject, getClientPortalContext } from '@/lib/data/projects'
import { getClientPendingItems, getClientFacturasData, getClientServicesData } from '@/lib/data/client'
import { clientPortalTranslations, projectTranslations } from '@/lib/i18n'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

export default async function ClientProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const [locale, { slug }, context] = await Promise.all([getLocale(), params, getClientPortalContext()])
  if (context.mode === 'legacy') redirect('/cliente/dashboard')
  const project = await getAccessibleClientProject(slug)
  if (!project) notFound()
  const text = clientPortalTranslations[locale]
  const labels = projectTranslations[locale].capabilities
  const hasInvoices = context.navigation.some(item => item.id === 'facturas')
  const hasPacks = context.navigation.some(item => item.id === 'packs')
  const hasProducts = context.navigation.some(item => item.capability === 'products')
  const hasDomains = context.navigation.some(item => item.capability === 'domains')
  const hasHosting = context.navigation.some(item => item.capability === 'hosting')
  const hasRenewableServices = hasProducts || hasDomains || hasHosting
  const hasServices = hasPacks || hasRenewableServices
  const [pending, invoices, services] = await Promise.all([
    getClientPendingItems(context.client.id),
    hasInvoices ? getClientFacturasData(context.client.id) : Promise.resolve([]),
    hasServices ? getClientServicesData(context.client.id) : Promise.resolve({ packs: [] }),
  ])
  const pendingCount = pending.filter(item => item.status === 'pending').length
  const pendingTotal = invoices.filter(invoice => invoice.status === 'pending').reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0)
  const activeServices = services.packs.filter(pack => pack.status === 'active' && (
    pack.pack_type === 'domain' ? hasDomains : pack.pack_type === 'hosting' ? hasHosting :
    pack.pack_type === 'hours' || pack.pack_type === 'tasks' ? hasPacks :
    ['service', 'subscription', 'membership'].includes(pack.pack_type) && hasProducts
  ))
  const packs = activeServices.filter(pack => ['hours', 'tasks'].includes(pack.pack_type))
  const hoursCount = packs.filter(pack => pack.pack_type === 'hours').length
  const closedCount = packs.length - hoursCount
  const numberLocale = locale === 'en' ? 'en-GB' : 'es-ES'

  return (
    <div className="space-y-8">
      <header>
        {context.projects.length > 1 ? <Link href="/cliente/proyectos" className="text-sm font-semibold text-brand underline">{text.back}</Link> : null}
        <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-muted">{text.overview}</p>
        <h1 className="mt-1 text-2xl font-black">{project.name}</h1>
        <p className="mt-1 break-all text-muted">{project.domain} · {text.active}</p>
      </header>

      <section aria-labelledby="account-heading" className="rounded-2xl border border-line bg-white p-6">
        <h2 id="account-heading" className="font-bold">{text.account}</h2>
        {hasInvoices || hasServices ? <p className="mt-1 text-sm text-muted">{text.aggregated}</p> : null}
        <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-brand">
          <Link href="/cliente/pendientes" className="underline">{text.pending}: {pendingCount}</Link>
          <Link href="/cliente/mensajeria" className="underline">{text.messages}</Link>
          {hasInvoices ? <Link href="/cliente/facturas" className="underline">{text.invoices}: {pendingTotal.toLocaleString(numberLocale, { style: 'currency', currency: 'EUR' })}</Link> : null}
          {hasPacks ? <>
            <Link href="/cliente/bonos" className="underline">{labels.bonuses_reports}: {hoursCount}</Link>
            <Link href="/cliente/packs" className="underline">{text.packs}: {closedCount}</Link>
          </> : null}
          {hasRenewableServices ? <Link href="/cliente/servicios" className="underline">{text.services}: {activeServices.length - packs.length}</Link> : null}
        </div>
        {activeServices.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm">
            {activeServices.map(pack => <li key={pack.id}>
              {pack.name}{pack.renewal_date ? <> · {text.renewal} <time dateTime={pack.renewal_date}>{new Date(pack.renewal_date).toLocaleDateString(numberLocale, { timeZone: 'UTC' })}</time></> : null}
            </li>)}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="tools-heading">
        <h2 id="tools-heading" className="mb-4 font-bold">{text.tools}</h2>
        {project.capabilities.length === 0 ? <p className="text-sm text-muted">{text.noTools}</p> : (
          <div className="grid gap-4 sm:grid-cols-2">
            {project.capabilities.map(capability => {
              const key = capability.capability_key
              const accountCapability = key === 'invoices' || key === 'bonuses_reports'
              const navigation = context.navigation.find(item => item.projectId === project.id && item.capability === key)
              const accountHref = key === 'invoices' ? '/cliente/facturas' : key === 'bonuses_reports' ? '/cliente/bonos' : '/cliente/servicios'
              const href = accountCapability ? accountHref : key === 'blogger' || key === 'analytics' ? navigation?.href : capability.launch_url ?? (key === 'hosting' ? project.hosting_management_url : null) ?? accountHref
              if (!href) return null
              return (
                <article id={key} key={key} className="rounded-2xl border border-line bg-white p-6">
                  <h3 className="font-semibold">{labels[key]}{accountCapability ? '' : ` · ${project.name}`}</h3>
                  <p className="mt-1 break-all text-sm text-muted">{accountCapability ? text.aggregated : project.domain}</p>
                  {key === 'hosting' && project.hosting_label ? <p className="mt-2 text-sm">{project.hosting_label}</p> : null}
                  <Link href={href} className="mt-4 inline-block text-sm font-semibold text-brand underline">
                    {text.open} {labels[key]}{accountCapability ? '' : ` · ${project.name}`}
                  </Link>
                  {key === 'blogger' ? <p className="mt-2 text-xs text-muted">{text.bloggerNote}</p> : null}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
