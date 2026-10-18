import { timingSafeEqual } from 'node:crypto'

import { validateProjectDestination } from './model.mjs'

export const PROJECT_CAPABILITY_KEYS = Object.freeze([
  'products',
  'domains',
  'hosting',
  'invoices',
  'bonuses_reports',
  'blogger',
  'analytics',
])

export class ProjectProvisioningError extends Error {
  constructor(code, status = 500) {
    super(code)
    this.name = 'ProjectProvisioningError'
    this.code = code
    this.status = status
  }
}

function invalidPayload() {
  throw new ProjectProvisioningError('invalid_payload', 400)
}

function normalizeSlug(value) {
  if (typeof value !== 'string') invalidPayload()
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug || slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) invalidPayload()
  return slug
}

function normalizeDomain(value) {
  if (typeof value !== 'string' || !value.trim()) invalidPayload()
  const raw = value.trim()
  let url
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    invalidPayload()
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port ||
      (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) invalidPayload()

  const domain = url.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '')
  if (!validateProjectDestination(`https://${domain}`, domain, true)) invalidPayload()
  return domain
}

export function normalizeProjectRegistration(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalidPayload()
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name || name.length > 200) invalidPayload()
  return Object.freeze({
    name,
    slug: normalizeSlug(input.slug),
    domain: normalizeDomain(input.domain),
  })
}

export function isProvisioningAuthorized(authorization, expectedSecret) {
  if (typeof authorization !== 'string' || typeof expectedSecret !== 'string' || !expectedSecret) return false
  const match = authorization.match(/^Bearer ([^\s]+)$/)
  if (!match) return false
  const supplied = Buffer.from(match[1])
  const expected = Buffer.from(expectedSecret)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

async function readProject(db, field, value) {
  const { data, error } = await db.from('client_projects').select('*').ilike(field, value).maybeSingle()
  if (error) throw new ProjectProvisioningError('provisioning_failed')
  return data
}

async function resolveProjectIdentity(db, identity) {
  const [bySlug, byDomain] = await Promise.all([
    readProject(db, 'slug', identity.slug),
    readProject(db, 'domain', identity.domain),
  ])

  if (bySlug && byDomain && bySlug.id !== byDomain.id) {
    throw new ProjectProvisioningError('identity_conflict', 409)
  }
  if (bySlug && (bySlug.domain.toLowerCase() !== identity.domain || bySlug.slug.toLowerCase() !== identity.slug)) {
    throw new ProjectProvisioningError('slug_conflict', 409)
  }
  if (byDomain && (byDomain.slug.toLowerCase() !== identity.slug || byDomain.domain.toLowerCase() !== identity.domain)) {
    throw new ProjectProvisioningError('domain_conflict', 409)
  }
  return bySlug ?? byDomain ?? null
}

function capabilityDefaults(projectId, keys = PROJECT_CAPABILITY_KEYS) {
  return keys.map(capabilityKey => ({
    project_id: projectId,
    capability_key: capabilityKey,
    state: 'unavailable',
    launch_url: null,
    metadata: {},
    validated_at: null,
  }))
}

async function ensureCapabilityDefaults(db, projectId) {
  const readCapabilities = () => db.from('project_capabilities').select('capability_key').eq('project_id', projectId)
  let { data: existing, error } = await readCapabilities()
  if (error) throw new ProjectProvisioningError('provisioning_failed')

  const existingKeys = new Set((existing ?? []).map(row => row.capability_key))
  const missingKeys = PROJECT_CAPABILITY_KEYS.filter(key => !existingKeys.has(key))
  if (!missingKeys.length) return

  const inserted = await db.from('project_capabilities').insert(capabilityDefaults(projectId, missingKeys))
  if (!inserted.error) return

  // A concurrent safe retry can win the unique insert. Accept that race only
  // after a fresh read proves every default row now exists.
  ;({ data: existing, error } = await readCapabilities())
  const recoveredKeys = new Set((existing ?? []).map(row => row.capability_key))
  if (error || PROJECT_CAPABILITY_KEYS.some(key => !recoveredKeys.has(key))) {
    throw new ProjectProvisioningError('provisioning_failed')
  }
}

export async function provisionProject(db, input) {
  const identity = normalizeProjectRegistration(input)
  let project = await resolveProjectIdentity(db, identity)
  let outcome = 'existing'

  if (!project) {
    const created = await db.from('client_projects').insert({
      ...identity,
      client_id: null,
      status: 'draft',
      client_access_enabled: false,
      hosting_label: null,
      hosting_management_url: null,
      analytics_registry_key: null,
    }).select('*').single()

    if (created.error || !created.data) {
      // Unique constraints are the final concurrency guard. Re-read to turn an
      // exact concurrent registration into the same idempotent response.
      project = await resolveProjectIdentity(db, identity)
      if (!project) throw new ProjectProvisioningError('provisioning_failed')
    } else {
      project = created.data
      outcome = 'created'
    }
  }

  await ensureCapabilityDefaults(db, project.id)
  return { outcome, project }
}
