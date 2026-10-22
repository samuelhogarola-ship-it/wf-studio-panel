import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAccessibleClientProject, getCapabilityConfigurationIssue, getClientPortalContext } from '@/lib/data/projects'
import { getClientPendingItems, getClientFacturasData, getClientServicesData } from '@/lib/data/client'
import { clientPortalTranslations, projectTranslations } from '@/lib/i18n'
import { getLocale } from '@/lib/locale'
import { buildProjectTools } from '@/lib/projects/tools.mjs'

export const dynamic = 'force-dynamic'

export default async function ClientProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const [locale, { slug }, context] = await Promise.all([getLocale(), params, getClientPortalContext()])
  const project = await getAccessibleClientProject(slug)
  if (!project) notFound()
  const text = clientPortalTranslations[locale]
  const labels = projectTranslations[locale].capabilities
  const projectTools = new Map(context.projects.map(candidate => {
    const configurationIssues = Object.fromEntries(candidate.capabilities.flatMap(capability => {
      const issue = getCapabilityConfigurationIssue(candidate, capability)
      return issue ? [[capability.capability_key, issue]] : []
    }))
    return [candidate.id, new Map(buildProjectTools({ project: candidate, viewer: 'client', configurationIssues }).map(tool => [tool.id, tool]))]
  }))
  const selectedTools = projectTools.get(project.id) ?? new Map()
  const hasTool = (id: 'domains' | 'hosting' | 'invoices' | 'reports') => [...projectTools.values()].some(tools => tools.has(id))
  const hasActive = (key: string) => context.projects.some(candidate => candidate.capabilities.some(capability =>
    capability.capability_key === key && capability.state === 'active'))
  const hasInvoices = hasTool('invoices')
  const hasPacks = hasTool('reports')
  const hasProducts = hasActive('products')
  const hasDomains = hasTool('domains')
  const hasHosting = hasTool('hosting')
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
  const workspaceTools = [...selectedTools.values()]
  const toolLabel = (id: string) => {
    if (id === 'website') return text.website
    if (id === 'reports') return text.reports
    if (id === 'bonuses') return text.bonuses
    if (id === 'blogger' || id === 'analytics' || id === 'domains' || id === 'hosting' || id === 'invoices') return labels[id]
    return id
  }

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
        {workspaceTools.length === 0 ? <p className="text-sm text-muted">{text.noTools}</p> : (
          <div className="grid gap-4 sm:grid-cols-2">
            {workspaceTools.map(tool => {
              if (!tool.href) return null
              const label = toolLabel(tool.id)
              const accountCapability = tool.id === 'invoices' || tool.id === 'reports' || tool.id === 'bonuses'
              const title = `${label}${accountCapability ? '' : ` · ${project.name}`}`
              const action = `${text.open} ${title}`
              return (
                <article id={tool.id} key={tool.id} className="rounded-2xl border border-line bg-white p-6">
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 break-all text-sm text-muted">{accountCapability ? text.aggregated : project.domain}</p>
                  {tool.id === 'hosting' && project.hosting_label ? <p className="mt-2 text-sm">{project.hosting_label}</p> : null}
                  {tool.id === 'website'
                    ? <a href={tool.href} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-semibold text-brand underline">{action}</a>
                    : <Link href={tool.href} className="mt-4 inline-block text-sm font-semibold text-brand underline">{action}</Link>}
                  {tool.id === 'blogger' ? <p className="mt-2 text-xs text-muted">{text.bloggerNote}</p> : null}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
