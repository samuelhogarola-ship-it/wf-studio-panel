import type { CanonicalDirectoryProfile } from '../types'
import type { DirectoryPublicationStatus } from '../../supabase/types'

export type DirectoryChannelKey = 'vivir-fuengirola' | 'conoce-fuengirola'

export type PublicationChannel = {
  channelId: string
  channelKey: DirectoryChannelKey
  enabled: boolean
  publicSlug: string
  categorySlug: string | null
  editorialPlacement: boolean
}

export type CanonicalPublicationSnapshot = {
  profile: CanonicalDirectoryProfile
  channels: PublicationChannel[]
  sourceUpdatedAt: string
}

export type PublicationProjection = Record<string, unknown> & {
  canonical_profile_id: string
  source_version: number
  plan: CanonicalDirectoryProfile['plan']
  payload_hash: string
}

export type ChannelProjection = PublicationProjection & {
  public_slug: string
}

export type VivirChannelProjection = PublicationProjection & {
  slug: string
}

export type PreparedProjection = {
  channelId: string
  channelKey: DirectoryChannelKey
  publicSlug: string
  payloadHash: string
}

export type PublicationEvent = PreparedProjection & {
  eventId: string
  sourceVersion: number
  status: DirectoryPublicationStatus
}

export type ChannelPublicationResult = {
  channelKey: DirectoryChannelKey
  sourceVersion: number
  status: 'published' | 'failed'
  remoteRecordId?: string
  errorCode?: string
  errorMessage?: string
}

export type PublicationResult = {
  profileId: string
  sourceVersion: number
  channels: ChannelPublicationResult[]
}

export type PublicationAdapter = {
  publish(snapshot: CanonicalPublicationSnapshot, channel: PublicationChannel, sourceVersion: number): Promise<{ remoteRecordId: string }>
}

export type PublicationRepository = {
  loadPublicationCandidate(profileId: string): Promise<CanonicalPublicationSnapshot>
  preparePublication(snapshot: CanonicalPublicationSnapshot, projections: PreparedProjection[]): Promise<{ sourceVersion: number; events: PublicationEvent[] }>
  loadRetryCandidate(profileId: string, channelKey: DirectoryChannelKey, sourceVersion: number): Promise<{ snapshot: CanonicalPublicationSnapshot; event: PublicationEvent }>
  markPublishing(eventId: string): Promise<void>
  markPublished(eventId: string, remoteRecordId: string): Promise<void>
  markFailed(eventId: string, error: { code: string; message: string }): Promise<void>
}
