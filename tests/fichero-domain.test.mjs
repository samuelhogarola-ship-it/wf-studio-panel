import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canRenderMiniweb,
  canShowContactActions,
  canShowEditorialPlacement,
  canShowRecommendedPlacement,
  getPlanEntitlements,
} from '../src/lib/fichero/entitlements.mjs'
import {
  normalizeDirectoryIdentity,
  parseDirectoryProfileInput,
  stablePayloadHash,
} from '../src/lib/fichero/validation.mjs'

const validInput = {
  canonicalSlug: 'clinica-malaga-sol',
  legalName: 'Clínica Málaga y Sol, S.L.',
  displayName: 'Clínica Málaga & Sol',
  cif: ' B-12.345.678 ',
  contactEmail: ' INFO@Example.COM ',
  phone: '+34 600 123 456',
  whatsapp: '0034 611 222 333',
  website: 'https://example.com/servicios',
  address: 'Calle Málaga 3, Fuengirola',
  latitude: 36.539,
  longitude: -4.624,
  categoryKey: 'salud',
  categoryLabel: 'Salud',
  neighborhoodKeys: [' centro ', 'los-boliches', 'centro'],
  shortDescription: 'Atención sanitaria local.',
  longDescription: 'Una clínica con atención profesional en Fuengirola.',
  seoTitle: 'Clínica Málaga y Sol en Fuengirola',
  seoDescription: 'Servicios sanitarios y atención profesional en Fuengirola.',
  services: [' Fisioterapia ', 'Rehabilitación', 'Fisioterapia'],
  schedule: ['Lunes: 09:00-18:00'],
  photos: ['https://example.com/clinica.jpg'],
  plan: 'premium',
  ignoredByContract: 'must be stripped',
}

test('gratis stays searchable without commercial or profile entitlements', () => {
  assert.deepEqual(getPlanEntitlements('gratis'), {
    directoryListing: true,
    search: true,
    recommendedPlacement: false,
    contactActions: false,
    miniweb: false,
    seo: false,
    stats: 'none',
    editorialPlacement: false,
  })
  assert.equal(canRenderMiniweb('gratis'), false)
  assert.equal(canShowContactActions('gratis'), false)
})

test('pro adds recommendation, contact actions and basic stats but no miniweb', () => {
  const rights = getPlanEntitlements('pro')

  assert.equal(rights.recommendedPlacement, true)
  assert.equal(rights.contactActions, true)
  assert.equal(rights.stats, 'basic')
  assert.equal(rights.miniweb, false)
  assert.equal(rights.editorialPlacement, false)
  assert.equal(canShowRecommendedPlacement('pro'), true)
})

test('premium adds miniweb, SEO, advanced stats and editorial placement', () => {
  const rights = getPlanEntitlements('premium')

  assert.equal(rights.directoryListing, true)
  assert.equal(rights.contactActions, true)
  assert.equal(rights.miniweb, true)
  assert.equal(rights.seo, true)
  assert.equal(rights.stats, 'advanced')
  assert.equal(rights.editorialPlacement, true)
  assert.equal(canShowEditorialPlacement('premium'), true)
})

test('unknown plans fail closed instead of inheriting paid rights', () => {
  assert.throws(() => getPlanEntitlements('enterprise'), /unsupported directory plan/i)
})

test('canonical parsing normalizes identifiers and arrays while preserving display accents', () => {
  const result = parseDirectoryProfileInput(validInput)

  assert.equal(result.success, true)
  assert.equal(result.data.displayName, 'Clínica Málaga & Sol')
  assert.equal(result.data.contactEmail, 'info@example.com')
  assert.equal(result.data.cif, 'B12345678')
  assert.equal(result.data.phone, '+34600123456')
  assert.equal(result.data.whatsapp, '+34611222333')
  assert.equal(result.data.canonicalSlug, 'clinica-malaga-sol')
  assert.deepEqual(result.data.neighborhoodKeys, ['centro', 'los-boliches'])
  assert.deepEqual(result.data.services, ['Fisioterapia', 'Rehabilitación'])
  assert.equal('ignoredByContract' in result.data, false)
})

test('canonical parsing reports field errors for invalid required and network fields', () => {
  const result = parseDirectoryProfileInput({
    ...validInput,
    displayName: '   ',
    categoryKey: '',
    categoryLabel: '',
    contactEmail: 'not-an-email',
    website: 'javascript:alert(1)',
  })

  assert.equal(result.success, false)
  assert.deepEqual(Object.keys(result.fieldErrors).sort(), [
    'categoryKey',
    'categoryLabel',
    'contactEmail',
    'displayName',
    'website',
  ])
})

test('custom category requires its human label', () => {
  const result = parseDirectoryProfileInput({
    ...validInput,
    categoryKey: '__otro__',
    categoryLabel: '',
  })

  assert.equal(result.success, false)
  assert.match(result.fieldErrors.categoryLabel[0], /categoría personalizada/i)
})

test('canonical parsing rejects unknown plans and bounded collection or text overflow', () => {
  const result = parseDirectoryProfileInput({
    ...validInput,
    plan: 'normal',
    shortDescription: 'x'.repeat(321),
    services: Array.from({ length: 51 }, (_, index) => `Servicio ${index}`),
    photos: ['not-a-url'],
  })

  assert.equal(result.success, false)
  assert.ok(result.fieldErrors.plan)
  assert.ok(result.fieldErrors.shortDescription)
  assert.ok(result.fieldErrors.services)
  assert.ok(result.fieldErrors.photos)
})

test('identity normalization produces stable matching keys without changing display input', () => {
  const identity = normalizeDirectoryIdentity(validInput)

  assert.deepEqual(identity, {
    normalizedCif: 'B12345678',
    normalizedEmail: 'info@example.com',
    normalizedDomain: 'example.com',
    normalizedName: 'clinica malaga sol',
  })
  assert.equal(validInput.displayName, 'Clínica Málaga & Sol')
})

test('payload hashes are independent of object key insertion order', () => {
  const first = stablePayloadHash({ plan: 'pro', nested: { b: 2, a: 1 } })
  const second = stablePayloadHash({ nested: { a: 1, b: 2 }, plan: 'pro' })

  assert.match(first, /^[0-9a-f]{64}$/)
  assert.equal(first, second)
  assert.notEqual(first, stablePayloadHash({ plan: 'premium', nested: { a: 1, b: 2 } }))
})
