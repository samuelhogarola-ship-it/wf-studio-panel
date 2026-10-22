import { ProjectSelector } from '@/components/client/project-selector'
import { getClientPortalContext } from '@/lib/data/projects'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

export default async function ClientProjectsPage() {
  const [locale, context] = await Promise.all([getLocale(), getClientPortalContext()])
  return <ProjectSelector projects={context.projects} locale={locale} />
}
