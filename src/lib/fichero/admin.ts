import { requireAdmin } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { DirectoryPlan, DirectoryPublicationStatus, DirectoryReviewStatus, Tables } from '@/lib/supabase/types'

import type { CanonicalDirectoryProfile } from './types'
import type { DirectoryChannelKey } from './publication/types'

const PAGE_SIZE = 30
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type DirectoryAdminProfile = CanonicalDirectoryProfile & { ownerUserId: string | null }
export type DirectoryAdminChannel = {
  channelId: string
  channelKey: DirectoryChannelKey
  enabled: boolean
  publicSlug: string
  categorySlug: string | null
  editorialPlacement: boolean
  lastPublishedVersion: number | null
  lastPublicationStatus: DirectoryPublicationStatus | null
  lastPublicationError: string | null
}
export type DirectoryAdminEvent = {
  eventId: string
  channelKey: DirectoryChannelKey
  sourceVersion: number
  status: DirectoryPublicationStatus
  remoteRecordId: string | null
  errorMessage: string | null
  createdAt: string
}

function profileFromRow(row: Tables<'directory_profiles'>): DirectoryAdminProfile {
  return {
    id: row.id, catalogId: row.catalog_id, ownerUserId: row.owner_user_id,
    canonicalSlug: row.canonical_slug, legalName: row.legal_name, displayName: row.display_name,
    cif: row.cif, contactEmail: row.contact_email, phone: row.phone, whatsapp: row.whatsapp,
    website: row.website, address: row.address, latitude: row.latitude, longitude: row.longitude,
    categoryKey: row.category_key, categoryLabel: row.category_label, neighborhoodKeys: row.neighborhood_keys,
    shortDescription: row.short_description, longDescription: row.long_description,
    seoTitle: row.seo_title, seoDescription: row.seo_description, services: row.services,
    schedule: row.schedule, photos: row.photos, plan: row.plan, reviewStatus: row.review_status,
    contentVersion: row.content_version,
  }
}

function safeSearch(value?: string) {
  return (value ?? '').trim().slice(0, 120).replaceAll('\\', '\\\\').replaceAll(',', '')
}

export async function getDirectoryCatalogs() {
  await requireAdmin()
  const db = await createSupabaseServerClient()
  const { data, error } = await db.from('directory_catalogs').select('id,key,name,status').eq('status', 'active').order('name')
  if (error) throw new Error('No se pudieron cargar los directorios.')
  return data ?? []
}

export async function getDirectoryCatalog(catalogKey: string) {
  await requireAdmin()
  const db = await createSupabaseServerClient()
  const { data, error } = await db.from('directory_catalogs').select('id,key,name,status').eq('key', catalogKey).eq('status', 'active').maybeSingle()
  if (error) throw new Error('No se pudo cargar el directorio.')
  return data
}

export async function getDirectoryProfiles(input: {
  catalogKey: string
  query?: string
  plan?: DirectoryPlan
  reviewStatus?: DirectoryReviewStatus
  publicationStatus?: DirectoryPublicationStatus
  page?: number
}) {
  await requireAdmin()
  const db = await createSupabaseServerClient()
  const catalog = await getDirectoryCatalog(input.catalogKey)
  if (!catalog) return { profiles: [], page: 1, pageSize: PAGE_SIZE, total: 0 }
  const page = Math.max(1, Math.trunc(input.page ?? 1))
  let allowedProfileIds: string[] | null = null
  if (input.publicationStatus) {
    const { data: links, error } = await db.from('directory_profile_channels').select('profile_id').eq('last_publication_status', input.publicationStatus)
    if (error) throw new Error('No se pudo aplicar el filtro de publicación.')
    allowedProfileIds = [...new Set((links ?? []).map(link => link.profile_id))]
    if (allowedProfileIds.length === 0) return { profiles: [], page, pageSize: PAGE_SIZE, total: 0 }
  }
  let query = db.from('directory_profiles').select('*', { count: 'exact' }).eq('catalog_id', catalog.id)
  const search = safeSearch(input.query)
  if (search) query = query.or(`display_name.ilike.%${search}%,legal_name.ilike.%${search}%,canonical_slug.ilike.%${search}%,contact_email.ilike.%${search}%,cif.ilike.%${search}%`)
  if (input.plan) query = query.eq('plan', input.plan)
  if (input.reviewStatus) query = query.eq('review_status', input.reviewStatus)
  if (allowedProfileIds) query = query.in('id', allowedProfileIds)
  const { data, error, count } = await query.order('updated_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (error) throw new Error('No se pudieron cargar las fichas.')
  return { profiles: (data ?? []).map(profileFromRow), page, pageSize: PAGE_SIZE, total: count ?? 0 }
}

export async function findDirectoryProfileDuplicates(input: { catalogId: string; profileId?: string; cif?: string | null; email?: string | null; displayName?: string | null }) {
  await requireAdmin()
  const db = await createSupabaseServerClient()
  const matches = new Map<string, Tables<'directory_profiles'>>()
  const checks = [
    input.cif ? db.from('directory_profiles').select('*').eq('catalog_id', input.catalogId).ilike('cif', input.cif) : null,
    input.email ? db.from('directory_profiles').select('*').eq('catalog_id', input.catalogId).ilike('contact_email', input.email) : null,
    input.displayName ? db.from('directory_profiles').select('*').eq('catalog_id', input.catalogId).ilike('display_name', input.displayName) : null,
  ].filter(Boolean) as Array<PromiseLike<{ data: Tables<'directory_profiles'>[] | null; error: unknown }>>
  for (const result of await Promise.all(checks)) {
    if (result.error) throw new Error('No se pudieron comprobar posibles duplicados.')
    for (const row of result.data ?? []) if (row.id !== input.profileId) matches.set(row.id, row)
  }
  return [...matches.values()].map(profileFromRow)
}

export async function getDirectoryProfile(catalogKey: string, profileId: string) {
  await requireAdmin()
  if (!UUID_PATTERN.test(profileId)) return null
  const db = await createSupabaseServerClient()
  const catalog = await getDirectoryCatalog(catalogKey)
  if (!catalog) return null
  const { data: row, error } = await db.from('directory_profiles').select('*').eq('id', profileId).eq('catalog_id', catalog.id).maybeSingle()
  if (error) throw new Error('No se pudo cargar la ficha.')
  if (!row) return null
  const [{ data: links }, { data: channelRows }, { data: eventRows }, { data: reviews }] = await Promise.all([
    db.from('directory_profile_channels').select('*').eq('profile_id', profileId),
    db.from('directory_channels').select('id,key').eq('catalog_id', catalog.id),
    db.from('directory_publication_events').select('*').eq('profile_id', profileId).order('created_at', { ascending: false }).limit(50),
    db.from('directory_profile_reviews').select('*').eq('profile_id', profileId).order('created_at', { ascending: false }).limit(20),
  ])
  const keys = new Map((channelRows ?? []).map(channel => [channel.id, channel.key as DirectoryChannelKey]))
  const channels: DirectoryAdminChannel[] = (links ?? []).map(link => ({
    channelId: link.channel_id, channelKey: keys.get(link.channel_id)!, enabled: link.enabled,
    publicSlug: link.public_slug, categorySlug: link.category_slug, editorialPlacement: link.editorial_placement,
    lastPublishedVersion: link.last_published_version, lastPublicationStatus: link.last_publication_status,
    lastPublicationError: link.last_publication_error,
  })).filter(channel => channel.channelKey)
  const events: DirectoryAdminEvent[] = (eventRows ?? []).map(event => ({
    eventId: event.id, channelKey: keys.get(event.channel_id)!, sourceVersion: event.source_version,
    status: event.status, remoteRecordId: event.remote_record_id, errorMessage: event.error_message, createdAt: event.created_at,
  })).filter(event => event.channelKey)
  const profile = profileFromRow(row)
  const duplicates = await findDirectoryProfileDuplicates({ catalogId: catalog.id, profileId, cif: profile.cif, email: profile.contactEmail, displayName: profile.displayName })
  return { catalog, profile, channels, events, reviews: reviews ?? [], duplicates }
}

export async function getDirectoryPublicationFeed(catalogKey: string) {
  await requireAdmin()
  const db = await createSupabaseServerClient()
  const catalog = await getDirectoryCatalog(catalogKey)
  if (!catalog) return []
  const { data: profiles } = await db.from('directory_profiles').select('id,display_name').eq('catalog_id', catalog.id)
  const profileIds = (profiles ?? []).map(profile => profile.id)
  if (profileIds.length === 0) return []
  const { data: events, error } = await db.from('directory_publication_events').select('*').in('profile_id', profileIds).order('created_at', { ascending: false }).limit(100)
  if (error) throw new Error('No se pudieron cargar las publicaciones.')
  const names = new Map((profiles ?? []).map(profile => [profile.id, profile.display_name]))
  return (events ?? []).map(event => ({ ...event, displayName: names.get(event.profile_id) ?? 'Ficha' }))
}
