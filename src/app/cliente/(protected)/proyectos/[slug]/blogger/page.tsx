import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { getAccessibleClientProject, getClientPortalContext } from '@/lib/data/projects'
import { getSiteByKey } from '@/lib/sites/registry.mjs'

export const dynamic = 'force-dynamic'

export default async function ClientBloggerPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, context] = await Promise.all([params, getClientPortalContext()])
  if (context.mode === 'legacy') redirect('/cliente/dashboard')
  const project = await getAccessibleClientProject(slug)
  if (!project?.capabilities.some(capability => capability.capability_key === 'blogger' && capability.state === 'active')) notFound()
  let site
  try {
    site = getSiteByKey(slug)
  } catch {
    notFound()
  }
  if (!site.blogger.enabled || site.domain.replace(/^www\./, '') !== project.domain.replace(/^www\./, '')) notFound()

  return <div className="space-y-5">
    <header>
      <Link href={`/cliente/proyectos/${encodeURIComponent(project.slug)}`} className="text-sm font-semibold text-brand underline">← {project.name}</Link>
      <h1 className="mt-3 text-2xl font-black">Blogger · {project.name}</h1>
      <p className="mt-1 text-sm text-muted">Editor protegido para {project.domain}</p>
    </header>
    <iframe title={`Blogger · ${site.name}`} src={`/blogger/editor/index.html?siteKey=${encodeURIComponent(slug)}`} className="h-[calc(100vh-12rem)] min-h-[760px] w-full rounded-xl border border-line bg-white" />
  </div>
}
