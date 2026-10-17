import { redirect } from 'next/navigation'
import { ProjectSelector } from '@/components/client/project-selector'
import { getClientPortalContext } from '@/lib/data/projects'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

export default async function ClientProjectsPage() {
  const [locale, context] = await Promise.all([getLocale(), getClientPortalContext()])
  if (context.mode === 'legacy') redirect('/cliente/dashboard')
  if (context.projects.length === 1) redirect(`/cliente/proyectos/${encodeURIComponent(context.projects[0].slug)}`)
  return <ProjectSelector projects={context.projects} locale={locale} />
}
