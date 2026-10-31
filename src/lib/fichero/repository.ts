import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Json, Tables } from '@/lib/supabase/types'

import type {
  CanonicalPublicationSnapshot,
  DirectoryChannelKey,
  PreparedProjection,
  PublicationEvent,
  PublicationRepository,
} from './publication/types'

type DirectoryDb = Awaited<ReturnType<typeof createSupabaseServerClient>>
type ProfileRow = Tables<'directory_profiles'>
type ProfileChannelRow = Tables<'directory_profile_channels'>

const channelKeys = new Set<DirectoryChannelKey>(['vivir-fuengirola', 'conoce-fuengirola'])

function fail(message: string): never {
  throw new Error(message)
}

function profileFromRow(row: ProfileRow): CanonicalPublicationSnapshot['profile'] {
  return {
    id: row.id,
    catalogId: row.catalog_id,
    ownerUserId: row.owner_user_id,
    canonicalSlug: row.canonical_slug,
    legalName: row.legal_name,
    displayName: row.display_name,
    cif: row.cif,
    contactEmail: row.contact_email,
    phone: row.phone,
    whatsapp: row.whatsapp,
    website: row.website,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    categoryKey: row.category_key,
    categoryLabel: row.category_label,
    neighborhoodKeys: row.neighborhood_keys,
    shortDescription: row.short_description,
    longDescription: row.long_description,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    services: row.services,
    schedule: row.schedule,
    photos: row.photos,
    plan: row.plan,
    reviewStatus: row.review_status,
    contentVersion: row.content_version,
  }
}

async function loadCandidate(db: DirectoryDb, profileId: string): Promise<CanonicalPublicationSnapshot> {
  const { data: profile, error: profileError } = await db
    .from('directory_profiles')
    .select('*')
    .eq('id', profileId)
    .maybeSingle()
  if (profileError || !profile) fail('No se pudo cargar la ficha para publicar.')

  const { data: links, error: linksError } = await db
    .from('directory_profile_channels')
    .select('*')
    .eq('profile_id', profileId)
  if (linksError || !links) fail('No se pudieron cargar los canales de la ficha.')

  const channelIds = links.map(link => link.channel_id)
  const { data: channels, error: channelsError } = channelIds.length > 0
    ? await db.from('directory_channels').select('id,key,status').in('id', channelIds)
    : { data: [], error: null }
  if (channelsError || !channels) fail('No se pudieron resolver los canales de publicación.')
  const byId = new Map(channels.map(channel => [channel.id, channel]))

  return {
    sourceUpdatedAt: profile.updated_at,
    reviewedAt: profile.approved_at ?? profile.updated_at,
    profile: profileFromRow(profile),
    channels: links.map((link: ProfileChannelRow) => {
      const channel = byId.get(link.channel_id)
      if (!channel || !channelKeys.has(channel.key as DirectoryChannelKey)) fail('La ficha contiene un canal no compatible.')
      return {
        channelId: link.channel_id,
        channelKey: channel.key as DirectoryChannelKey,
        enabled: link.enabled && channel.status === 'active',
        publicSlug: link.public_slug,
        categorySlug: link.category_slug,
        lastPublicationStatus: link.last_publication_status,
        editorialPlacement: link.editorial_placement,
      }
    }),
  }
}

function eventFromRow(row: {
  event_id: string
  channel_id: string
  channel_key: string
  public_slug: string
  source_version: number
  payload_hash: string
  status: PublicationEvent['status']
}): PublicationEvent {
  if (!channelKeys.has(row.channel_key as DirectoryChannelKey)) fail('El evento contiene un canal no compatible.')
  return {
    eventId: row.event_id,
    channelId: row.channel_id,
    channelKey: row.channel_key as DirectoryChannelKey,
    publicSlug: row.public_slug,
    sourceVersion: row.source_version,
    payloadHash: row.payload_hash,
    status: row.status,
  }
}

export function directoryPublicationRepository(db: DirectoryDb): PublicationRepository {
  return {
    loadPublicationCandidate: profileId => loadCandidate(db, profileId),

    async preparePublication(snapshot, projections: PreparedProjection[]) {
      const payload = projections.map(projection => ({
        channelId: projection.channelId,
        channelKey: projection.channelKey,
        publicSlug: projection.publicSlug,
        payloadHash: projection.payloadHash,
      })) as Json
      const { data, error } = await db.rpc('prepare_directory_publication', {
        p_profile_id: snapshot.profile.id,
        p_expected_updated_at: snapshot.sourceUpdatedAt,
        p_projections: payload,
      })
      if (error || !data?.length) fail('No se pudo preparar la publicación de la ficha.')
      const events = data.map(eventFromRow)
      return { sourceVersion: events[0].sourceVersion, events }
    },

    async loadRetryCandidate(profileId, channelKey, sourceVersion) {
      const snapshot = await loadCandidate(db, profileId)
      const channel = snapshot.channels.find(candidate => candidate.channelKey === channelKey)
      if (!channel) fail('El canal solicitado no existe para la ficha.')
      const { data, error } = await db
        .from('directory_publication_events')
        .select('*')
        .eq('profile_id', profileId)
        .eq('channel_id', channel.channelId)
        .eq('source_version', sourceVersion)
        .maybeSingle()
      if (error || !data) fail('No se encontró el intento de publicación solicitado.')
      return {
        snapshot,
        event: {
          eventId: data.id,
          channelId: data.channel_id,
          channelKey,
          publicSlug: channel.publicSlug,
          sourceVersion: data.source_version,
          payloadHash: data.payload_hash,
          status: data.status,
        },
      }
    },

    async markPublishing(eventId) {
      const { data, error } = await db.rpc('begin_directory_publication_event', { p_event_id: eventId })
      if (error || !data) fail('El intento de publicación ya está procesándose o ha finalizado.')
    },

    async markPublished(eventId, remoteRecordId, status) {
      const { error } = await db.rpc('finish_directory_publication_event', {
        p_event_id: eventId,
        p_status: status,
        p_remote_record_id: remoteRecordId,
        p_error_code: null,
        p_error_message: null,
      })
      if (error) fail('No se pudo registrar la publicación completada.')
    },

    async markFailed(eventId, failure) {
      const { error } = await db.rpc('finish_directory_publication_event', {
        p_event_id: eventId,
        p_status: 'failed',
        p_remote_record_id: null,
        p_error_code: failure.code,
        p_error_message: failure.message,
      })
      if (error) fail('No se pudo registrar el fallo de publicación.')
    },
  }
}

export async function createDirectoryPublicationRepository() {
  return directoryPublicationRepository(await createSupabaseServerClient())
}
