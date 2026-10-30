const CHANNELS = new Set(['vivir-fuengirola', 'conoce-fuengirola'])

export function normalizeCif(value) {
  const normalized = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return normalized.length >= 8 ? normalized : null
}

export function normalizeDomain(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    return url.hostname.toLowerCase().replace(/^www\./, '') || null
  } catch {
    return null
  }
}

const normalizeEmail = value => {
  const email = String(value ?? '').trim().toLowerCase()
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null
}

const normalizeName = value => String(value ?? '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/\b(sl|slu|sa|fuengirola|malaga)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

export function compatibleBusinessName(left, right) {
  const a = normalizeName(left)
  const b = normalizeName(right)
  if (!a || !b) return false
  return a === b || a.startsWith(`${b} `) || b.startsWith(`${a} `)
}

function uniqueProfiles(profiles) {
  return [...new Map(profiles.map(profile => [profile.id, profile])).values()]
}

const matched = (reason, profile) => ({ status: 'matched', reason, profileId: profile.id })

export function matchBusinessToCanonical(row, canonicalProfiles) {
  if (
    !row || typeof row !== 'object' || !String(row.id ?? '').trim() ||
    !String(row.name ?? '').trim() || !String(row.slug ?? '').trim() ||
    !CHANNELS.has(row.channelKey)
  ) {
    return { status: 'invalid', reason: 'required_fields' }
  }

  const byCanonicalId = row.canonicalProfileId
    ? canonicalProfiles.filter(profile => profile.id === row.canonicalProfileId)
    : []
  if (row.canonicalProfileId && byCanonicalId.length === 0) {
    return { status: 'conflict', reason: 'unknown_canonical_profile_id', profileIds: [] }
  }

  const cif = normalizeCif(row.cif)
  const byCif = cif
    ? canonicalProfiles.filter(profile => normalizeCif(profile.cif) === cif)
    : []
  if (byCanonicalId.length === 0 && byCif.length > 1) {
    return { status: 'ambiguous', reason: 'cif', profileIds: byCif.map(profile => profile.id) }
  }
  const strong = uniqueProfiles([...byCanonicalId, ...byCif])
  if (strong.length > 1) {
    return {
      status: 'conflict',
      reason: 'strong_identifiers_disagree',
      profileIds: strong.map(profile => profile.id),
    }
  }
  if (byCanonicalId.length === 1) return matched('canonical_profile_id', byCanonicalId[0])
  if (byCif.length === 1) return matched('cif', byCif[0])

  const rowDomain = normalizeDomain(row.website)
  const rowEmail = normalizeEmail(row.contactEmail)
  const byContact = uniqueProfiles(canonicalProfiles.filter(profile => {
    const sameDomain = rowDomain && normalizeDomain(profile.website) === rowDomain
    const sameEmail = rowEmail && normalizeEmail(profile.contactEmail) === rowEmail
    return (sameDomain || sameEmail) && compatibleBusinessName(row.name, profile.displayName)
  }))
  if (byContact.length > 1) {
    return {
      status: 'ambiguous',
      reason: 'domain_or_contact',
      profileIds: byContact.map(profile => profile.id),
    }
  }
  if (byContact.length === 1) return matched('domain_or_contact', byContact[0])

  const bySlug = canonicalProfiles.filter(
    profile => profile.channelSlugs?.[row.channelKey] === row.slug,
  )
  if (bySlug.length > 1) {
    return { status: 'ambiguous', reason: 'channel_slug', profileIds: bySlug.map(profile => profile.id) }
  }
  if (bySlug.length === 1) return matched('channel_slug', bySlug[0])

  return { status: 'manual', reason: 'no_deterministic_match' }
}

export function redactReconciliationRow(row) {
  return {
    rowId: String(row.id ?? ''),
    channelKey: row.channelKey ?? null,
    slug: row.slug ?? null,
    name: row.name ?? null,
    canonicalProfileId: row.canonicalProfileId ?? null,
    domain: normalizeDomain(row.website),
    hasCif: Boolean(normalizeCif(row.cif)),
    hasContactEmail: Boolean(normalizeEmail(row.contactEmail)),
    hasPhone: Boolean(String(row.phone ?? '').trim()),
  }
}

export function buildReconciliationReport({ canonicalProfiles = [], vivirBusinesses = [], conoceBusinesses = [] }) {
  const report = {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    changesApplied: 0,
    counts: { matched: 0, vivir_only: 0, conoce_only: 0, ambiguous: 0, conflict: 0, invalid: 0 },
    matched: [],
    vivir_only: [],
    conoce_only: [],
    ambiguous: [],
    conflict: [],
    invalid: [],
  }
  for (const row of [
    ...vivirBusinesses.map(item => ({ ...item, channelKey: 'vivir-fuengirola' })),
    ...conoceBusinesses.map(item => ({ ...item, channelKey: 'conoce-fuengirola' })),
  ]) {
    const result = matchBusinessToCanonical(row, canonicalProfiles)
    const safeRow = { ...redactReconciliationRow(row), ...result }
    if (result.status === 'matched') {
      report.matched.push(safeRow)
      report.counts.matched += 1
    } else if (result.status === 'manual') {
      const bucket = row.channelKey === 'vivir-fuengirola' ? 'vivir_only' : 'conoce_only'
      report[bucket].push(safeRow)
      report.counts[bucket] += 1
    } else {
      report[result.status].push(safeRow)
      report.counts[result.status] += 1
    }
  }
  return report
}
