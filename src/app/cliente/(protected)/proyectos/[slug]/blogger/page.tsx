import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getAccessibleClientProject } from '@/lib/data/projects'
import { getBloggerEditorTarget } from '@/lib/blogger/editor.mjs'
import { getSiteByKey } from '@/lib/sites/registry.mjs'

export const dynamic = 'force-dynamic'

export default async function ClientBloggerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const project = await getAccessibleClientProject(slug)
  if (!project?.capabilities.some(capability => capability.capability_key === 'blogger' && capability.state === 'active')) notFound()
  let site
  try {
    site = getSiteByKey(slug)
  } catch {
    notFound()
  }
  if (!site.blogger.enabled || site.domain.replace(/^www\./, '') !== project.domain.replace(/^www\./, '')) notFound()
  const target = getBloggerEditorTarget(site)
  if (!target) notFound()

  return <div className="space-y-5">
    <header>
      <Link href={`/cliente/proyectos/${encodeURIComponent(project.slug)}`} className="text-sm font-semibold text-brand underline">← {project.name}</Link>
      <h1 className="mt-3 text-2xl font-black">Blogger · {project.name}</h1>
      <p className="mt-1 text-sm text-muted">Editor protegido para {project.domain}</p>
    </header>
    {target.kind === 'iframe'
      ? <iframe title={`Blogger · ${site.name}`} src={target.href} className="h-[calc(100vh-12rem)] min-h-[760px] w-full rounded-xl border border-line bg-white" />
      : <a href={target.href} rel="noopener noreferrer" className="inline-flex rounded-lg bg-brand px-4 py-3 font-bold text-white">Abrir Blogger · {site.name} ↗</a>}
  </div>
}
