import { notFound } from 'next/navigation'

import { FicheroNav } from '@/components/fichero/fichero-nav'
import { ProfileEditor } from '@/components/fichero/profile-editor'
import { PublicationStatus } from '@/components/fichero/publication-status'
import { ReviewPanel } from '@/components/fichero/review-panel'
import { AdminShell } from '@/components/layout/app-shell'
import { requireAdmin } from '@/lib/auth'
import { getDirectoryProfile } from '@/lib/fichero/admin'
import { getLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ catalogKey: string; profileId: string }> }) {
  const { catalogKey, profileId } = await params
  const [identity, locale, data] = await Promise.all([requireAdmin(), getLocale(), getDirectoryProfile(catalogKey, profileId)])
  if (!data) notFound()
  const path = `/paneladmin/fichero/${catalogKey}/fichas/${profileId}`
  return <AdminShell title={data.profile.displayName} description={`Estado: ${data.profile.reviewStatus} · versión ${data.profile.contentVersion}`} currentPath={path} userEmail={identity.email} locale={locale}><FicheroNav catalogKey={catalogKey} currentPath={`/paneladmin/fichero/${catalogKey}/fichas`} /><ProfileEditor catalogKey={catalogKey} profile={data.profile} channels={data.channels} duplicates={data.duplicates} /><ReviewPanel profileId={profileId} catalogKey={catalogKey} channels={data.channels} /><PublicationStatus profileId={profileId} catalogKey={catalogKey} events={data.events} /></AdminShell>
}
