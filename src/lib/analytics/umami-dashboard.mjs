import { getLegacyAnalyticsProjects, getSites } from '../sites/registry.mjs'
import {
  getAnalyticsMarketOptions,
  resolveAnalyticsDrilldown,
} from './analytics-profile.mjs'

const DAY_MS = 24 * 60 * 60 * 1000
const PERIODS = new Set(['live', '7d', '30d', '90d', '6m', '12m'])
const AUTH_CACHE_TTL_MS = 5 * 60 * 1000
const authCacheByFetch = new WeakMap()
const websiteCacheByFetch = new WeakMap()
export { getAnalyticsMarketOptions }

export function createRequestCoordinator() {
  let requestId = 0
  let controller = null

  return {
    next() {
      requestId += 1
      controller?.abort()
      controller = new AbortController()
      const currentId = requestId
      return {
        signal: controller.signal,
        isLatest: () => currentId === requestId && !controller.signal.aborted,
      }
    },
    abort() {
      requestId += 1
      controller?.abort()
    },
  }
}

export function normalizeSessionRows(response) {
  const rows = Array.isArray(response?.data) ? response.data : []
  return rows.map((row) => {
    const firstAt = typeof row?.firstAt === 'string' ? row.firstAt : null
    const lastAt = typeof row?.lastAt === 'string' ? row.lastAt : null
    const firstTime = firstAt ? Date.parse(firstAt) : Number.NaN
    const lastTime = lastAt ? Date.parse(lastAt) : Number.NaN
    const durationSeconds = Number.isFinite(firstTime) && Number.isFinite(lastTime)
      ? Math.max(0, Math.round((lastTime - firstTime) / 1000))
      : 0

    return {
      country: typeof row?.country === 'string' ? row.country : null,
      region: typeof row?.region === 'string' ? row.region : null,
      city: typeof row?.city === 'string' ? row.city : null,
      device: typeof row?.device === 'string' ? row.device : null,
      browser: typeof row?.browser === 'string' ? row.browser : null,
      operatingSystem: typeof row?.os === 'string' ? row.os : null,
      screen: typeof row?.screen === 'string' ? row.screen : null,
      language: typeof row?.language === 'string' ? row.language : null,
      views: Number.isFinite(Number(row?.views)) ? Number(row.views) : 0,
      visits: Number.isFinite(Number(row?.visits)) ? Number(row.visits) : 0,
      firstAt,
      lastAt,
      durationSeconds,
    }
  })
}

export function mergeSummaryRefresh(current, refresh) {
  if (current?.status !== 'ok' || refresh?.status !== 'ok') return refresh
  const merged = {
    ...refresh,
    metrics: current.metrics,
    sessions: current.sessions,
    sessionsAvailable: current.sessionsAvailable,
  }
  if (Object.prototype.hasOwnProperty.call(current, 'breakdowns')) merged.breakdowns = current.breakdowns
  return merged
}

export const ANALYTICS_PROJECTS = getLegacyAnalyticsProjects()
const CANONICAL_ANALYTICS_PROJECTS = getSites().map(site => ({
  key: site.key,
  label: site.name,
  domain: site.domain,
  source: site.analytics.source,
  envSuffix: site.analytics.envSuffix,
  legacyKey: site.analytics.legacyKey,
}))

const METRIC_TYPES = {
  entries: ['entry'],
  exits: ['exit'],
  titles: ['title'],
  queries: ['query'],
  referrers: ['referrer'],
  channels: ['channel'],
  domains: ['domain'],
  countries: ['country'],
  regions: ['region'],
  cities: ['city'],
  browsers: ['browser'],
  operatingSystems: ['os'],
  devices: ['device'],
  languages: ['language'],
  screens: ['screen'],
  events: ['event'],
  hostnames: ['hostname'],
}

export function normalizePeriod(period) {
  return PERIODS.has(period) ? period : '30d'
}

export function toClientAnalyticsPayload(dashboard) {
  if (dashboard?.status === 'configuration_error') {
    return {
      status: 'configuration_error',
      range: dashboard.range,
      message: 'Las estadísticas todavía no están disponibles.',
    }
  }

  const safeDashboard = { ...dashboard }
  delete safeDashboard.project
  delete safeDashboard.websiteId
  return safeDashboard
}

export function toPublicAnalyticsError(error) {
  const message = error instanceof Error ? error.message : ''
  if (message.startsWith('Proyecto de estadísticas desconocido')) {
    return { status: 404, message: 'Estadísticas no disponibles.' }
  }
  return { status: 502, message: 'No se pudieron cargar las estadísticas.' }
}

function subtractUtcMonths(date, months) {
  const result = new Date(date.getTime())
  const originalDay = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() - months)
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(originalDay, lastDay))
  return result
}

export function getAnalyticsRange(period, now = new Date()) {
  const key = normalizePeriod(period)
  const endAt = now.getTime()
  let startAt
  let unit = 'day'
  let label

  if (key === 'live') {
    startAt = endAt - DAY_MS
    unit = 'hour'
    label = 'Últimas 24 horas'
  } else if (key === '7d') {
    startAt = endAt - 7 * DAY_MS
    label = 'Últimos 7 días'
  } else if (key === '30d') {
    startAt = endAt - 30 * DAY_MS
    label = 'Últimos 30 días'
  } else if (key === '90d') {
    startAt = endAt - 90 * DAY_MS
    label = 'Últimos 90 días'
  } else if (key === '6m') {
    const start = subtractUtcMonths(now, 6)
    startAt = start.getTime()
    label = 'Últimos 6 meses'
  } else {
    const start = subtractUtcMonths(now, 12)
    startAt = start.getTime()
    unit = 'month'
    label = 'Últimos 12 meses'
  }

  return { key, label, startAt, endAt, unit }
}

export function getAnalyticsProject(projectKey, env = process.env) {
  const project = CANONICAL_ANALYTICS_PROJECTS.find(({ key }) => key === projectKey)
  if (!project) throw new Error(`Proyecto de estadísticas desconocido: ${projectKey}`)

  const legacySuffix = (project.legacyKey || project.key).toUpperCase()
  const suffix = project.envSuffix || legacySuffix
  const websiteIdEnv = `UMAMI_WEBSITE_ID_${suffix}`
  const legacyWebsiteIdEnv = `STAT_REPORT_UMAMI_WEBSITE_ID_${legacySuffix}`
  const domainEnv = `UMAMI_DOMAIN_${suffix}`
  const legacyDomainEnv = `STAT_REPORT_UMAMI_DOMAIN_${legacySuffix}`
  return {
    ...project,
    domain: env[domainEnv]?.trim() || env[legacyDomainEnv]?.trim() || project.domain,
    websiteId: env[websiteIdEnv]?.trim() || env[legacyWebsiteIdEnv]?.trim() || undefined,
    websiteIdEnv,
  }
}

function apiUrl(baseUrl, endpoint, params) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const url = new URL(endpoint.replace(/^\//, ''), normalizedBase)
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
  }
  return url
}

async function requestJson(url, { token, method = 'GET', body, fetchImpl = fetch, timeoutMs = 8_000 } = {}) {
  const controller = new AbortController()
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error(`Tiempo de espera agotado al consultar Umami (${timeoutMs} ms)`))
    }, timeoutMs)
  })
  let response
  try {
    response = await Promise.race([
      fetchImpl(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        cache: 'no-store',
        signal: controller.signal,
      }),
      timeout,
    ])
  } finally {
    clearTimeout(timer)
  }
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Umami respondió HTTP ${response.status}`)
  }
  return data
}

async function authenticate({ baseUrl, username, password, fetchImpl, timeoutMs }) {
  let cache = authCacheByFetch.get(fetchImpl)
  if (!cache) {
    cache = new Map()
    authCacheByFetch.set(fetchImpl, cache)
  }
  const key = `${baseUrl}\u0000${username}\u0000${password}`
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.promise

  const promise = requestJson(apiUrl(baseUrl, '/api/auth/login'), {
    method: 'POST',
    body: { username, password },
    fetchImpl,
    timeoutMs,
  }).then((response) => {
    if (!response?.token) throw new Error('Umami no devolvió un token de acceso')
    return response.token
  })
  cache.set(key, { promise, expiresAt: Date.now() + AUTH_CACHE_TTL_MS })
  try {
    return await promise
  } catch (error) {
    cache.delete(key)
    throw error
  }
}

async function resolveWebsiteId({ baseUrl, token, project, fetchImpl, timeoutMs }) {
  if (project.websiteId) return project.websiteId
  let cache = websiteCacheByFetch.get(fetchImpl)
  if (!cache) {
    cache = new Map()
    websiteCacheByFetch.set(fetchImpl, cache)
  }
  const cacheKey = `${baseUrl}\u0000${project.domain}\u0000${project.label}`
  const cachedId = cache.get(cacheKey)
  if (cachedId) return cachedId

  const response = await requestJson(apiUrl(baseUrl, '/api/websites', { pageSize: 200 }), {
    token,
    fetchImpl,
    timeoutMs,
  })
  const websites = Array.isArray(response) ? response : response?.data || []
  const normalizedDomain = project.domain.toLowerCase()
  const normalizedLabel = project.label.toLowerCase()
  const match = websites.find((website) => {
    const domain = String(website.domain || '').toLowerCase()
    const name = String(website.name || '').toLowerCase()
    return domain === normalizedDomain || name === normalizedLabel
  })
  const websiteId = match?.id || match?.websiteId || match?.website_id
  if (websiteId) cache.set(cacheKey, websiteId)
  return websiteId
}

function metricValue(metric) {
  if (typeof metric === 'number' && Number.isFinite(metric)) return metric
  if (metric && typeof metric.value === 'number' && Number.isFinite(metric.value)) return metric.value
  return 0
}

function metricPrevious(name, stats) {
  const metric = stats?.[name]
  if (metric && typeof metric.prev === 'number') return metric.prev
  if (stats?.comparison && typeof stats.comparison[name] === 'number') return stats.comparison[name]
  return null
}

function summaryMetric(name, stats) {
  const value = metricValue(stats?.[name])
  const previous = metricPrevious(name, stats)
  return {
    value,
    previous,
    change: previous === null ? null : value - previous,
    changePercent: previous ? ((value - previous) / previous) * 100 : null,
  }
}

function derivedMetric(value, previous = null) {
  return {
    value: Number.isFinite(value) ? value : 0,
    previous: Number.isFinite(previous) ? previous : null,
    change: Number.isFinite(previous) ? value - previous : null,
    changePercent: previous ? ((value - previous) / previous) * 100 : null,
  }
}

async function fetchMetric({ baseUrl, websiteId, token, range, types, fetchImpl, timeoutMs, filters = {}, limit = 10 }) {
  for (const type of types) {
    try {
      const response = await requestJson(
        apiUrl(baseUrl, `/api/websites/${websiteId}/metrics`, {
          startAt: range.startAt,
          endAt: range.endAt,
          type,
          limit,
          ...filters,
        }),
        { token, fetchImpl, timeoutMs },
      )
      if (Array.isArray(response)) return response
    } catch {
      // Metric names differ between Umami v2 and v3. Try the next alias.
    }
  }
  return []
}

async function fetchEventSummary({ baseUrl, websiteId, token, range, fetchImpl, timeoutMs, filters = {} }) {
  try {
    const response = await requestJson(
      apiUrl(baseUrl, `/api/websites/${websiteId}/events/stats`, {
        startAt: range.startAt,
        endAt: range.endAt,
        compare: 'prev',
        ...filters,
      }),
      { token, fetchImpl, timeoutMs },
    )
    const data = response?.data || response
    if (typeof data?.events === 'number') {
      return derivedMetric(
        data.events,
        typeof data.comparison?.events === 'number' ? data.comparison.events : null,
      )
    }
  } catch {
    // Umami v2 has no event stats endpoint; aggregate its event-only metric instead.
  }

  const rows = await fetchMetric({
    baseUrl,
    websiteId,
    token,
    range,
    types: ['event'],
    fetchImpl,
    timeoutMs,
    filters,
    limit: 500,
  })
  return derivedMetric(rows.reduce((total, row) => total + Number(row.y || 0), 0))
}

function breakdownMetrics(stats) {
  const pageviews = metricValue(stats?.pageviews)
  const visitors = metricValue(stats?.visitors)
  const visits = metricValue(stats?.visits)
  const bounces = metricValue(stats?.bounces)
  const totalTime = metricValue(stats?.totaltime)
  return {
    pageviews,
    visitors,
    visits,
    bounceRate: visits ? bounces / visits * 100 : 0,
    pagesPerVisit: visits ? pageviews / visits : 0,
    averageVisitSeconds: visits ? totalTime / visits : 0,
  }
}

async function fetchBreakdownRow({
  baseUrl,
  websiteId,
  token,
  range,
  fetchImpl,
  timeoutMs,
  projectKey,
  market,
  dimension,
  option,
}) {
  const filters = resolveAnalyticsDrilldown(projectKey, {
    market,
    [dimension]: option.key,
  }).filters
  try {
    const stats = await requestJson(
      apiUrl(baseUrl, `/api/websites/${websiteId}/stats`, {
        startAt: range.startAt,
        endAt: range.endAt,
        ...filters,
      }),
      { token, fetchImpl, timeoutMs },
    )
    return { ...option, status: 'ok', ...breakdownMetrics(stats) }
  } catch {
    return {
      ...option,
      status: 'unavailable',
      pageviews: null,
      visitors: null,
      visits: null,
      bounceRate: null,
      pagesPerVisit: null,
      averageVisitSeconds: null,
    }
  }
}

async function fetchProfileBreakdowns({
  baseUrl,
  websiteId,
  token,
  range,
  fetchImpl,
  timeoutMs,
  projectKey,
  market,
  dimensions,
  summaryOnly,
}) {
  if (summaryOnly) return { sections: [], contentLanguages: [], totalPageviews: null }
  const shared = { baseUrl, websiteId, token, range, fetchImpl, timeoutMs, projectKey, market }
  const marketFilters = resolveAnalyticsDrilldown(projectKey, { market }).filters
  const totalPageviewsPromise = requestJson(
    apiUrl(baseUrl, `/api/websites/${websiteId}/stats`, {
      startAt: range.startAt,
      endAt: range.endAt,
      ...marketFilters,
    }),
    { token, fetchImpl, timeoutMs },
  )
    .then(stats => metricValue(stats?.pageviews))
    .catch(() => null)
  const [totalPageviews, sections, contentLanguages] = await Promise.all([
    totalPageviewsPromise,
    Promise.all(dimensions.sections.map(option => fetchBreakdownRow({
      ...shared,
      dimension: 'section',
      option,
    }))),
    Promise.all(dimensions.contentLanguages.map(option => fetchBreakdownRow({
      ...shared,
      dimension: 'contentLanguage',
      option,
    }))),
  ])
  return { sections, contentLanguages, totalPageviews }
}

export async function fetchUmamiDashboard({
  projectKey,
  period = '30d',
  env = process.env,
  now = new Date(),
  fetchImpl = fetch,
  timeoutMs = 8_000,
  summaryOnly = false,
  includeContentLanguages = false,
  market = 'all',
  section,
  contentLanguage,
  device,
  referrer,
  event,
}) {
  const project = getAnalyticsProject(projectKey, env)
  const drilldown = resolveAnalyticsDrilldown(projectKey, {
    market,
    section,
    contentLanguage,
    device,
    referrer,
    event,
  })
  const { dimensions, selected, filters } = drilldown
  const selectedMarket = selected.market
  const isFiltered = Object.keys(filters).some(key => key !== 'match')
  const isAgama = project.source === 'agama'
  const baseUrl = isAgama
    ? env.UMAMI_AGAMA_URL?.trim()
    : env.UMAMI_PERSONAL_URL?.trim() || env.STAT_REPORT_UMAMI_URL?.trim()
  const username = isAgama
    ? env.UMAMI_AGAMA_USERNAME?.trim() || 'admin'
    : env.UMAMI_PERSONAL_USERNAME?.trim() || env.STAT_REPORT_UMAMI_USERNAME?.trim() || 'admin'
  const password = isAgama
    ? env.UMAMI_AGAMA_PASSWORD?.trim()
    : env.UMAMI_PERSONAL_PASSWORD?.trim() || env.STAT_REPORT_UMAMI_PASSWORD?.trim()
  const range = getAnalyticsRange(period, now)

  if (!baseUrl || !password) {
    return {
      status: 'configuration_error',
      project,
      market: selectedMarket,
      range,
      message: isAgama
        ? 'Faltan UMAMI_AGAMA_URL o UMAMI_AGAMA_PASSWORD en Coolify.'
        : 'Faltan UMAMI_PERSONAL_URL o UMAMI_PERSONAL_PASSWORD en Coolify.',
    }
  }

  const token = await authenticate({ baseUrl, username, password, fetchImpl, timeoutMs })
  const websiteId = await resolveWebsiteId({ baseUrl, token, project, fetchImpl, timeoutMs })
  if (!websiteId) {
    return {
      status: 'configuration_error',
      project,
      market: selectedMarket,
      range,
      message: `No se encontró el sitio en Umami. Configura ${project.websiteIdEnv} en Coolify.`,
    }
  }

  const baseParams = { startAt: range.startAt, endAt: range.endAt, ...filters }
  const corePromise = Promise.allSettled([
    isFiltered
      ? Promise.resolve(null)
      : requestJson(apiUrl(baseUrl, `/api/websites/${websiteId}/active`), { token, fetchImpl, timeoutMs }),
    requestJson(apiUrl(baseUrl, `/api/websites/${websiteId}/stats`, baseParams), { token, fetchImpl, timeoutMs }),
    requestJson(apiUrl(baseUrl, `/api/websites/${websiteId}/pageviews`, {
      ...baseParams,
      unit: range.unit,
      timezone: 'Europe/Madrid',
    }), { token, fetchImpl, timeoutMs }),
    fetchEventSummary({ baseUrl, websiteId, token, range, fetchImpl, timeoutMs, filters }),
  ])
  const metricsPromise = summaryOnly
    ? includeContentLanguages
      ? fetchMetric({
          baseUrl,
          websiteId,
          token,
          range,
          types: METRIC_TYPES.events,
          fetchImpl,
          timeoutMs,
          filters,
          limit: 500,
        })
        .then((contentLanguageEvents) => ({ contentLanguageEvents }))
        .catch(() => ({ contentLanguageEvents: [] }))
      : Promise.resolve({})
    : Promise.allSettled([
        fetchMetric({
          baseUrl,
          websiteId,
          token,
          range,
          types: ['url', 'path'],
          fetchImpl,
          timeoutMs,
          filters,
          limit: 500,
        }),
        ...Object.values(METRIC_TYPES).map((types) => (
          fetchMetric({ baseUrl, websiteId, token, range, types, fetchImpl, timeoutMs, filters })
        )),
      ]).then(([pagesResult, ...metricResults]) => {
        const result = {
          pages: pagesResult?.status === 'fulfilled' ? pagesResult.value : [],
        }
        Object.keys(METRIC_TYPES).forEach((key, index) => {
          const metricResult = metricResults[index]
          result[key] = metricResult?.status === 'fulfilled' ? metricResult.value : []
        })
        return result
      })
  const sessionsPromise = summaryOnly
    ? Promise.resolve({ rows: [], available: false })
    : requestJson(apiUrl(baseUrl, `/api/websites/${websiteId}/sessions`, {
        ...baseParams,
        page: 1,
        pageSize: 20,
        orderBy: 'lastAt',
      }), { token, fetchImpl, timeoutMs })
      .then((response) => ({ rows: normalizeSessionRows(response), available: true }))
      .catch(() => ({ rows: [], available: false }))

  const breakdownsPromise = fetchProfileBreakdowns({
    baseUrl,
    websiteId,
    token,
    range,
    fetchImpl,
    timeoutMs,
    projectKey,
    market: selectedMarket.key,
    dimensions,
    summaryOnly,
  })

  const [[activeResult, statsResult, pageviewsResult, eventsResult], metrics, sessions, breakdowns] = await Promise.all([
    corePromise,
    metricsPromise,
    sessionsPromise,
    breakdownsPromise,
  ])

  if (statsResult.status === 'rejected') throw statsResult.reason
  if (pageviewsResult.status === 'rejected') throw pageviewsResult.reason

  const stats = statsResult.value || {}
  const pageviews = summaryMetric('pageviews', stats)
  const visitors = summaryMetric('visitors', stats)
  const visits = summaryMetric('visits', stats)
  const bounces = summaryMetric('bounces', stats)
  const totalTime = summaryMetric('totaltime', stats)
  const previousBounceRate = visits.previous ? (bounces.previous || 0) / visits.previous * 100 : null
  const previousAverageVisit = visits.previous ? (totalTime.previous || 0) / visits.previous : null
  const previousPagesPerVisit = visits.previous ? (pageviews.previous || 0) / visits.previous : null

  const events = eventsResult.status === 'fulfilled'
    ? eventsResult.value
    : derivedMetric((metrics.events || []).reduce((total, row) => total + Number(row.y || 0), 0))
  return {
    status: 'ok',
    project,
    websiteId,
    market: selectedMarket,
    dimensions,
    selected,
    breakdowns,
    range,
    generatedAt: now.toISOString(),
    activeVisitors: isFiltered
      ? null
      : activeResult.status === 'fulfilled' ? Number(activeResult.value?.visitors || 0) : null,
    summary: {
      pageviews,
      visitors,
      visits,
      bounces,
      totalTime,
      bounceRate: derivedMetric(visits.value ? bounces.value / visits.value * 100 : 0, previousBounceRate),
      averageVisitSeconds: derivedMetric(visits.value ? totalTime.value / visits.value : 0, previousAverageVisit),
      pagesPerVisit: derivedMetric(visits.value ? pageviews.value / visits.value : 0, previousPagesPerVisit),
      events,
    },
    series: {
      pageviews: Array.isArray(pageviewsResult.value?.pageviews) ? pageviewsResult.value.pageviews : [],
      visitors: Array.isArray(pageviewsResult.value?.sessions) ? pageviewsResult.value.sessions : [],
    },
    metrics,
    sessions: sessions.rows,
    sessionsAvailable: sessions.available,
  }
}
