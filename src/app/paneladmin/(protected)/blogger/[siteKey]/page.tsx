import { notFound } from 'next/navigation'

import { AdminShell } from '@/components/layout/app-shell'
import { getBloggerEditorTarget } from '@/lib/blogger/editor.mjs'
import { requireAdmin } from '@/lib/auth'
import { getLocale } from '@/lib/locale'
import { getSiteByKey } from '@/lib/sites/registry.mjs'

export default async function BloggerPage({ params }: { params: Promise<{ siteKey: string }> }) {
  const identity = await requireAdmin()
  const { siteKey } = await params
  const site = getSiteByKey(siteKey)
  if (!site.blogger.enabled) notFound()
  const target = getBloggerEditorTarget(site)
  if (!target) notFound()
  const handoff = typeof site.blogger.launchUrl === 'string'
  return <AdminShell title={`Blogger · ${site.name}`} description="Publicación estática" currentPath="/paneladmin/proyectos" userEmail={identity.email} locale={await getLocale()}>{handoff
    ? <form action={`/api/tools/blogger/${encodeURIComponent(site.key)}/launch`} method="post"><button type="submit" className="inline-flex rounded-lg bg-brand px-4 py-3 font-bold text-white">Abrir Blogger · {site.name} ↗</button></form>
    : target.kind === 'iframe'
    ? <iframe title={`Blogger · ${site.name}`} src={target.href} className="h-[calc(100vh-12rem)] min-h-[760px] w-full rounded-xl border border-line bg-white" />
    : <a href={target.href} rel="noopener noreferrer" className="inline-flex rounded-lg bg-brand px-4 py-3 font-bold text-white">Abrir Blogger · {site.name} ↗</a>}</AdminShell>
}
