import type { DirectoryPlan, DirectoryPublicationStatus, DirectoryReviewStatus } from '@/lib/supabase/types'

export type DirectoryStatsLevel = 'none' | 'basic' | 'advanced'

export type DirectoryPlanEntitlements = {
  directoryListing: true
  search: true
  recommendedPlacement: boolean
  contactActions: boolean
  miniweb: boolean
  seo: boolean
  stats: DirectoryStatsLevel
  editorialPlacement: boolean
}

export type CanonicalDirectoryProfile = {
  id: string
  catalogId: string
  canonicalSlug: string
  legalName: string | null
  displayName: string
  cif: string | null
  contactEmail: string | null
  phone: string | null
  whatsapp: string | null
  website: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  categoryKey: string
  categoryLabel: string
  neighborhoodKeys: string[]
  shortDescription: string
  longDescription: string
  seoTitle: string | null
  seoDescription: string | null
  services: string[]
  schedule: string[]
  photos: string[]
  plan: DirectoryPlan
  reviewStatus: DirectoryReviewStatus
  contentVersion: number
}

export type DirectoryChannelPublication = {
  profileId: string
  channelId: string
  enabled: boolean
  publicSlug: string
  editorialPlacement: boolean
  lastPublishedVersion: number | null
  lastPublicationStatus: DirectoryPublicationStatus | null
  lastPublicationError: string | null
}
