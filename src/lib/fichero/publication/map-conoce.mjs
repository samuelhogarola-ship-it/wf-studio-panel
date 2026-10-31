import { getPlanEntitlements } from '../entitlements.mjs'
import { stablePayloadHash } from '../validation.mjs'

export function mapConocePublication(snapshot, channel, sourceVersion) {
  const profile = snapshot.profile
  const rights = getPlanEntitlements(profile.plan)
  const projection = {
    canonical_profile_id: profile.id,
    source_version: sourceVersion,
    slug: channel.publicSlug,
    name: profile.displayName,
    legal_name: profile.legalName,
    cif: profile.cif,
    contact_email: profile.contactEmail,
    category: profile.categoryLabel,
    category_slug: channel.categorySlug,
    description: profile.longDescription,
    summary: profile.shortDescription,
    location: profile.address || 'Fuengirola',
    neighborhood: profile.neighborhoodKeys[0] || 'Fuengirola',
    image: profile.photos[0] || '/icon.svg',
    featured: rights.recommendedPlacement,
    services: profile.services,
    highlights: [],
    tags: [],
    website: profile.website,
    phone: profile.phone,
    whatsapp: profile.whatsapp,
    schedule: profile.schedule,
    photos: profile.photos,
    latitude: profile.latitude,
    longitude: profile.longitude,
    seo_title: profile.seoTitle,
    seo_description: profile.seoDescription,
    source_label: 'Fichero · revisión humana',
    last_verified: (snapshot.reviewedAt ?? snapshot.sourceUpdatedAt).slice(0, 10),
    plan: profile.plan,
    is_recommended: rights.recommendedPlacement,
    contact_actions_enabled: rights.contactActions,
    miniweb_enabled: rights.miniweb,
    seo_enabled: rights.seo,
    stats_level: rights.stats,
    editorial_placement: rights.editorialPlacement && channel.editorialPlacement,
    channel_enabled: channel.enabled,
    publication_status: channel.enabled ? 'published' : 'withdrawn',
    published_at: snapshot.reviewedAt ?? snapshot.sourceUpdatedAt,
  }
  return { ...projection, payload_hash: stablePayloadHash(projection) }
}
