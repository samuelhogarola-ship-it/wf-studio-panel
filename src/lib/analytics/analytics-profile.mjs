import { getSiteByKey } from '../sites/registry.mjs'

const DEVICES = Object.freeze([
  { key: 'mobile', label: 'Móvil' },
  { key: 'desktop', label: 'Ordenador' },
  { key: 'tablet', label: 'Tablet' },
  { key: 'laptop', label: 'Portátil' },
])
const WEBFUENGIROLA_MARKETS = Object.freeze([
  { key: 'all', label: 'Total' },
  { key: 'spain', label: 'España / resto' },
  { key: 'mexico', label: 'México' },
  { key: 'usa', label: 'USA' },
  { key: 'brazil', label: 'Brasil' },
])
const WEBFUENGIROLA_MARKET_FILTERS = Object.freeze({
  mexico: { path: 're.^/mexico(?:/|$)' },
  usa: { path: 're.^/usa(?:/|$)' },
  brazil: { path: 're.^/brasil(?:/|$)' },
  spain: {
    path: 'nre.^/mexico(?:/|$)',
    path1: 'nre.^/usa(?:/|$)',
    path2: 'nre.^/brasil(?:/|$)',
    match: 'all',
  },
})
const SAFE_REFERRER = /^[a-z0-9](?:[a-z0-9.-]{0,118}[a-z0-9])?$/i

function profileFor(projectKey) {
  try {
    return getSiteByKey(projectKey).analytics?.profile || null
  } catch {
    return null
  }
}

function publicOption(item) {
  return { key: item.key, label: item.label }
}

export function getAnalyticsMarketOptions(projectKey) {
  return projectKey === 'webfuengirola' ? WEBFUENGIROLA_MARKETS : []
}

export function getAnalyticsDimensions(projectKey) {
  const profile = profileFor(projectKey)
  return {
    markets: getAnalyticsMarketOptions(projectKey),
    sections: (profile?.sections || []).map(publicOption),
    contentLanguages: (profile?.languages || []).map(publicOption),
    devices: DEVICES,
    events: (profile?.allowedEvents || []).map(item => ({
      key: item.key,
      label: item.label,
      category: item.category || 'general',
    })),
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizedPath(value) {
  const path = String(value || '').trim().replace(/\/{2,}/g, '/')
  if (!path || !path.startsWith('/') || path.includes('..') || /[?#]/.test(path)) return null
  return path === '/' ? '/' : path.replace(/\/+$/, '')
}

function routeFilter(item) {
  const exact = (item?.routes?.exact || [])
    .map(normalizedPath)
    .filter(Boolean)
    .map(path => path === '/' ? '/$' : `${escapeRegex(path)}(?:/)?$`)
  const prefixes = (item?.routes?.prefixes || [])
    .map(normalizedPath)
    .filter(Boolean)
    .map(path => path === '/' ? '/.*' : `${escapeRegex(path)}(?:/|$)`)
  const alternatives = [...new Set([...exact, ...prefixes])]
  return alternatives.length ? `re.^(?:${alternatives.join('|')})` : null
}

function selectOption(options, value) {
  return options.find(option => option.key === value) || null
}

function appendPathFilter(filters, value) {
  if (!value) return
  let index = 0
  while (Object.prototype.hasOwnProperty.call(filters, index ? `path${index}` : 'path')) index += 1
  filters[index ? `path${index}` : 'path'] = value
}

function selectedProfileItem(profileItems, selected) {
  return selected ? (profileItems || []).find(item => item.key === selected.key) || null : null
}

export function resolveAnalyticsDrilldown(projectKey, input = {}) {
  const profile = profileFor(projectKey)
  const dimensions = getAnalyticsDimensions(projectKey)
  const markets = dimensions.markets
  const market = selectOption(markets, input.market) || markets[0] || { key: 'all', label: 'Total' }
  const section = selectOption(dimensions.sections, input.section)
  const contentLanguage = selectOption(dimensions.contentLanguages, input.contentLanguage)
  const device = selectOption(dimensions.devices, input.device)
  const event = selectOption(dimensions.events, input.event)
  const candidateReferrer = String(input.referrer || '').trim()
  const referrer = candidateReferrer.length <= 120 && SAFE_REFERRER.test(candidateReferrer)
    ? candidateReferrer
    : ''
  const filters = {
    ...(market.key === 'all' ? {} : WEBFUENGIROLA_MARKET_FILTERS[market.key] || {}),
  }

  appendPathFilter(filters, routeFilter(selectedProfileItem(profile?.sections, section)))
  appendPathFilter(filters, routeFilter(selectedProfileItem(profile?.languages, contentLanguage)))
  if (device) filters.device = device.key
  if (referrer) filters.referrer = referrer
  if (event) filters.event = event.key
  if (Object.keys(filters).filter(key => key !== 'match').length > 1) filters.match = 'all'

  return {
    dimensions,
    selected: {
      market,
      section,
      contentLanguage,
      device,
      referrer,
      event,
    },
    filters,
  }
}
