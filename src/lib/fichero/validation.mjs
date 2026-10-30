import { createHash } from 'node:crypto'

const plans = new Set(['gratis', 'pro', 'premium'])
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const limits = Object.freeze({
  canonicalSlug: 100,
  legalName: 200,
  displayName: 160,
  cif: 32,
  contactEmail: 254,
  phone: 32,
  whatsapp: 32,
  website: 2048,
  address: 300,
  categoryKey: 80,
  categoryLabel: 120,
  shortDescription: 320,
  longDescription: 6000,
  seoTitle: 70,
  seoDescription: 160,
})

const text = value => typeof value === 'string' ? value.trim() : ''

function withoutDiacritics(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function slugify(value) {
  return withoutDiacritics(text(value).toLowerCase())
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeName(value) {
  return withoutDiacritics(text(value).toLowerCase())
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeCif(value) {
  return text(value).toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function normalizeEmail(value) {
  return text(value).toLowerCase()
}

function normalizePhone(value) {
  const raw = text(value)
  if (!raw) return ''
  const international = raw.startsWith('00') ? `+${raw.slice(2)}` : raw
  const digits = international.replace(/\D/g, '')
  return international.startsWith('+') ? `+${digits}` : digits
}

function parseHttpUrl(value) {
  const raw = text(value)
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

function addError(errors, field, message) {
  if (!errors[field]) errors[field] = []
  errors[field].push(message)
}

function boundedText(input, field, max, errors, { required = false } = {}) {
  const value = text(input[field])
  if (required && !value) addError(errors, field, 'Este campo es obligatorio.')
  if (value.length > max) addError(errors, field, `No puede superar ${max} caracteres.`)
  return value
}

function boundedArray(input, field, maxItems, maxLength, errors, transform = text) {
  const raw = input[field]
  if (raw == null) return []
  if (!Array.isArray(raw)) {
    addError(errors, field, 'Debe ser una lista.')
    return []
  }
  if (raw.length > maxItems) addError(errors, field, `No puede contener más de ${maxItems} elementos.`)

  const values = []
  const seen = new Set()
  raw.forEach((item, index) => {
    const value = transform(item)
    if (!value) return
    if (value.length > maxLength) {
      addError(errors, field, `El elemento ${index + 1} supera ${maxLength} caracteres.`)
      return
    }
    const duplicateKey = value.toLocaleLowerCase('es')
    if (!seen.has(duplicateKey)) {
      seen.add(duplicateKey)
      values.push(value)
    }
  })
  return values
}

function optionalCoordinate(input, field, min, max, errors) {
  if (input[field] == null || input[field] === '') return null
  if (typeof input[field] !== 'number' || !Number.isFinite(input[field]) || input[field] < min || input[field] > max) {
    addError(errors, field, `Debe ser un número entre ${min} y ${max}.`)
    return null
  }
  return input[field]
}

export function parseDirectoryProfileInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { success: false, fieldErrors: { form: ['El perfil debe ser un objeto.'] } }
  }

  const errors = {}
  const displayName = boundedText(input, 'displayName', limits.displayName, errors, { required: true })
  const categoryKey = boundedText(input, 'categoryKey', limits.categoryKey, errors, { required: true })
  const categoryLabel = boundedText(input, 'categoryLabel', limits.categoryLabel, errors, { required: true })
  if (categoryKey === '__otro__' && !categoryLabel) {
    errors.categoryLabel = ['Indica el nombre de la categoría personalizada.']
  }

  const canonicalSlug = slugify(input.canonicalSlug || displayName)
  if (!canonicalSlug) addError(errors, 'canonicalSlug', 'No se ha podido generar un slug válido.')
  if (canonicalSlug.length > limits.canonicalSlug) addError(errors, 'canonicalSlug', `No puede superar ${limits.canonicalSlug} caracteres.`)

  const legalName = boundedText(input, 'legalName', limits.legalName, errors)
  const cif = normalizeCif(input.cif)
  if (cif.length > limits.cif) addError(errors, 'cif', `No puede superar ${limits.cif} caracteres.`)

  const contactEmail = normalizeEmail(input.contactEmail)
  if (contactEmail && (!emailPattern.test(contactEmail) || contactEmail.length > limits.contactEmail)) {
    addError(errors, 'contactEmail', 'Introduce un email válido.')
  }

  const phone = normalizePhone(input.phone)
  const whatsapp = normalizePhone(input.whatsapp)
  if (phone.length > limits.phone) addError(errors, 'phone', `No puede superar ${limits.phone} caracteres.`)
  if (whatsapp.length > limits.whatsapp) addError(errors, 'whatsapp', `No puede superar ${limits.whatsapp} caracteres.`)

  const websiteInput = boundedText(input, 'website', limits.website, errors)
  const websiteUrl = parseHttpUrl(websiteInput)
  if (websiteInput && !websiteUrl) addError(errors, 'website', 'Introduce una URL HTTP o HTTPS válida.')

  const photos = boundedArray(input, 'photos', 20, 2048, errors)
  if (photos.some(photo => !parseHttpUrl(photo))) addError(errors, 'photos', 'Todas las fotos deben usar URLs HTTP o HTTPS válidas.')

  const plan = text(input.plan) || 'gratis'
  if (!plans.has(plan)) addError(errors, 'plan', 'Selecciona un plan válido.')

  const data = {
    canonicalSlug,
    legalName: legalName || null,
    displayName,
    cif: cif || null,
    contactEmail: contactEmail || null,
    phone: phone || null,
    whatsapp: whatsapp || null,
    website: websiteUrl?.toString() ?? null,
    address: boundedText(input, 'address', limits.address, errors) || null,
    latitude: optionalCoordinate(input, 'latitude', -90, 90, errors),
    longitude: optionalCoordinate(input, 'longitude', -180, 180, errors),
    categoryKey,
    categoryLabel,
    neighborhoodKeys: boundedArray(input, 'neighborhoodKeys', 20, 100, errors, slugify),
    shortDescription: boundedText(input, 'shortDescription', limits.shortDescription, errors),
    longDescription: boundedText(input, 'longDescription', limits.longDescription, errors),
    seoTitle: boundedText(input, 'seoTitle', limits.seoTitle, errors) || null,
    seoDescription: boundedText(input, 'seoDescription', limits.seoDescription, errors) || null,
    services: boundedArray(input, 'services', 50, 160, errors),
    schedule: boundedArray(input, 'schedule', 21, 160, errors),
    photos,
    plan,
  }

  return Object.keys(errors).length > 0
    ? { success: false, fieldErrors: errors }
    : { success: true, data }
}

export function normalizeDirectoryIdentity(input) {
  const email = normalizeEmail(input?.contactEmail)
  const website = parseHttpUrl(input?.website)
  const emailDomain = email.includes('@') ? email.split('@').at(-1) : ''
  const domain = website?.hostname || emailDomain

  return {
    normalizedCif: normalizeCif(input?.cif) || null,
    normalizedEmail: email || null,
    normalizedDomain: domain ? domain.toLowerCase().replace(/^www\./, '') : null,
    normalizedName: normalizeName(input?.displayName || input?.legalName) || null,
  }
}

function stableValue(value, inArray = false) {
  if (value === null || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(item => stableValue(item, true) ?? null)
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter(key => value[key] !== undefined)
        .map(key => [key, stableValue(value[key])]),
    )
  }
  return inArray ? null : undefined
}

export function stablePayloadHash(input) {
  const serialized = JSON.stringify(stableValue(input))
  if (serialized === undefined) throw new TypeError('Payload must be JSON serializable')
  return createHash('sha256').update(serialized).digest('hex')
}
