import Link from 'next/link'
import { notFound } from 'next/navigation'

import { FicheroNav } from '@/components/fichero/fichero-nav'
import { ProfileList } from '@/components/fichero/profile-list'
import { AdminShell } from '@/components/layout/app-shell'
import { requireAdmin } from '@/lib/auth'
import { getDirectoryCatalog, getDirectoryProfiles } from '@/lib/fichero/admin'
import { getLocale } from '@/lib/locale'
import type { DirectoryPlan, DirectoryPublicationStatus, DirectoryReviewStatus } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
const plans = new Set<DirectoryPlan>(['gratis', 'pro', 'premium'])
const reviews = new Set<DirectoryReviewStatus>(['draft', 'pending_review', 'approved', 'rejected', 'archived'])
const publications = new Set<DirectoryPublicationStatus>(['pending', 'publishing', 'published', 'failed', 'withdrawn'])

export default async function Page({ params, searchParams }: { params: Promise<{ catalogKey: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ catalogKey }, query] = await Promise.all([params, searchParams])
  const plan = plans.has(query.plan as DirectoryPlan) ? query.plan as DirectoryPlan : undefined
  const reviewStatus = reviews.has(query.review as DirectoryReviewStatus) ? query.review as DirectoryReviewStatus : undefined
  const publicationStatus = publications.has(query.publication as DirectoryPublicationStatus) ? query.publication as DirectoryPublicationStatus : undefined
  const [identity, locale, catalog, data] = await Promise.all([requireAdmin(), getLocale(), getDirectoryCatalog(catalogKey), getDirectoryProfiles({ catalogKey, query: query.q, plan, reviewStatus, publicationStatus, page: Number(query.page) || 1 })])
  if (!catalog) notFound()
  const path = `/paneladmin/fichero/${catalogKey}/fichas`
  const filters = { q: query.q ?? '', plan: query.plan ?? '', review: query.review ?? '', publication: query.publication ?? '' }
  return <AdminShell title={`Fichas · ${catalog.name}`} description="Un registro canónico para todos los canales" currentPath={path} userEmail={identity.email} locale={locale}><FicheroNav catalogKey={catalogKey} currentPath={path} /><div className="mb-4 flex justify-end"><Link href={`${path}/nueva`} className="rounded-full bg-brand px-5 py-2 font-bold text-white">Nueva ficha</Link></div><ProfileList catalogKey={catalogKey} data={data} filters={filters} /></AdminShell>
}
