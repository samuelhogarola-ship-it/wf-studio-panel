const entitlementMatrix = Object.freeze({
  gratis: Object.freeze({
    directoryListing: true,
    search: true,
    recommendedPlacement: false,
    contactActions: false,
    miniweb: false,
    seo: false,
    stats: 'none',
    editorialPlacement: false,
  }),
  pro: Object.freeze({
    directoryListing: true,
    search: true,
    recommendedPlacement: true,
    contactActions: true,
    miniweb: false,
    seo: false,
    stats: 'basic',
    editorialPlacement: false,
  }),
  premium: Object.freeze({
    directoryListing: true,
    search: true,
    recommendedPlacement: true,
    contactActions: true,
    miniweb: true,
    seo: true,
    stats: 'advanced',
    editorialPlacement: true,
  }),
})

export function getPlanEntitlements(plan) {
  const entitlements = entitlementMatrix[plan]
  if (!entitlements) throw new TypeError(`Unsupported directory plan: ${String(plan)}`)
  return entitlements
}

export const canRenderMiniweb = plan => getPlanEntitlements(plan).miniweb
export const canShowContactActions = plan => getPlanEntitlements(plan).contactActions
export const canShowRecommendedPlacement = plan => getPlanEntitlements(plan).recommendedPlacement
export const canShowEditorialPlacement = plan => getPlanEntitlements(plan).editorialPlacement
