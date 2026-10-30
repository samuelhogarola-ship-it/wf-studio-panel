import { getPlanEntitlements } from '../entitlements.mjs'
import { stablePayloadHash } from '../validation.mjs'

export function mapCanonicalPublication(snapshot, channel, sourceVersion) {
  const profile = snapshot.profile
  const rights = getPlanEntitlements(profile.plan)
  const projection = {
    canonical_profile_id: profile.id,
    source_version: sourceVersion,
    public_slug: channel.publicSlug,
    legal_name: profile.legalName,
    display_name: profile.displayName,
    cif: profile.cif,
    contact_email: profile.contactEmail,
    phone: profile.phone,
    whatsapp: profile.whatsapp,
    website: profile.website,
    address: profile.address,
    latitude: profile.latitude,
    longitude: profile.longitude,
    category_key: profile.categoryKey,
    category_label: profile.categoryLabel,
    neighborhood_keys: profile.neighborhoodKeys,
    short_description: profile.shortDescription,
    long_description: profile.longDescription,
    seo_title: profile.seoTitle,
    seo_description: profile.seoDescription,
    services: profile.services,
    schedule: profile.schedule,
    photos: profile.photos,
    plan: profile.plan,
    is_recommended: rights.recommendedPlacement,
    contact_actions_enabled: rights.contactActions,
    miniweb_enabled: rights.miniweb,
    seo_enabled: rights.seo,
    stats_level: rights.stats,
    editorial_placement: rights.editorialPlacement,
  }
  return { ...projection, payload_hash: stablePayloadHash(projection) }
}

export const mapVivirPublication = mapCanonicalPublication
