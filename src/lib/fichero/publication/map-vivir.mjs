import { getPlanEntitlements } from '../entitlements.mjs'
import { stablePayloadHash } from '../validation.mjs'

export function mapCanonicalPublication(snapshot, channel, sourceVersion) {
  const profile = snapshot.profile
  const rights = getPlanEntitlements(profile.plan)
  const projection = {
    canonical_profile_id: profile.id,
    source_version: sourceVersion,
    owner_user_id: profile.ownerUserId ?? null,
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
    editorial_placement: rights.editorialPlacement && channel.editorialPlacement,
  }
  return { ...projection, payload_hash: stablePayloadHash(projection) }
}

export function mapVivirPublication(snapshot, channel, sourceVersion) {
  const profile = snapshot.profile
  const rights = getPlanEntitlements(profile.plan)
  const projection = {
    canonical_profile_id: profile.id,
    source_version: sourceVersion,
    owner_user_id: profile.ownerUserId ?? null,
    slug: channel.publicSlug,
    name: profile.displayName,
    legal_name: profile.legalName,
    cif: profile.cif,
    seo_title: profile.seoTitle,
    seo_description: profile.seoDescription,
    category_slug: profile.categoryKey,
    category_label: profile.categoryLabel,
    neighborhood_slugs: profile.neighborhoodKeys,
    short_description: profile.shortDescription,
    long_description: profile.longDescription,
    photos: profile.photos,
    image_url: profile.photos[0] ?? null,
    gallery_image_urls: profile.photos,
    phone: profile.phone,
    website: profile.website,
    contact_email: profile.contactEmail,
    address: profile.address || 'Fuengirola',
    latitude: profile.latitude,
    longitude: profile.longitude,
    schedule: profile.schedule,
    whatsapp: profile.whatsapp,
    status: 'publicado',
    plan: profile.plan,
    featured_reason: 'Ficha aprobada mediante revisión humana en Fichero',
    source_label: 'Fichero · revisión humana',
    source_verified_at: snapshot.sourceUpdatedAt.slice(0, 10),
    services: profile.services,
    credentials: [],
    profiles: [],
    testimonials: [],
    is_recommended: rights.recommendedPlacement,
    contact_actions_enabled: rights.contactActions,
    miniweb_enabled: rights.miniweb,
    seo_enabled: rights.seo,
    stats_level: rights.stats,
    editorial_placement: rights.editorialPlacement && channel.editorialPlacement,
    channel_enabled: channel.enabled,
    publication_status: 'published',
    published_at: snapshot.sourceUpdatedAt,
  }
  return { ...projection, payload_hash: stablePayloadHash(projection) }
}
