const DAY_MS = 24 * 60 * 60 * 1000
const PERIODS = new Set(['live', '7d', '30d', '90d', '6m', '12m'])
const AUTH_CACHE_TTL_MS = 5 * 60 * 1000
const authCacheByFetch = new WeakMap()
const websiteCacheByFetch = new WeakMap()

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

export const ANALYTICS_PROJECTS = [
  { key: 'webfuengirola', label: 'Web Fuengirola', domain: 'webfuengirola.com' },
  { key: 'vivirenfuengirola', label: 'Vivir en Fuengirola', domain: 'vivirenfuengirola.com' },
  { key: 'conocef', label: 'Conoce Fuengirola', domain: 'conocefuengirola.com' },
  { key: 'samuelcoachdealeman', label: 'Samuel Coach de Alemán', domain: 'samuelcoachdealeman.com' },
  { key: 'vokabelworld', label: 'Vokabel-World', domain: 'vokabellab.com' },
  { key: 'superentrenador', label: 'Superentrenador', domain: 'superentrenador.com' },
  { key: 'agama', label: 'Agama Marketplace', domain: 'agama.eco' },
]

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
  const project = ANALYTICS_PROJECTS.find(({ key }) => key === projectKey)
  if (!project) throw new Error(`Proyecto de estadísticas desconocido: ${projectKey}`)

  const suffix = project.key.toUpperCase()
  const websiteIdEnv = `STAT_REPORT_UMAMI_WEBSITE_ID_${suffix}`
  const domainEnv = `STAT_REPORT_UMAMI_DOMAIN_${suffix}`
  return {
    ...project,
    domain: env[domainEnv]?.trim() || project.domain,
    websiteId: env[websiteIdEnv]?.trim() || undefined,
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

async function fetchMetric({ baseUrl, websiteId, token, range, types, fetchImpl, timeoutMs, limit = 10 }) {
  for (const type of types) {
    try {
      const response = await requestJson(
        apiUrl(baseUrl, `/api/websites/${websiteId}/metrics`, {
          startAt: range.startAt,
          endAt: range.endAt,
          type,
          limit,
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

async function fetchEventSummary({ baseUrl, websiteId, token, range, fetchImpl, timeoutMs }) {
  try {
    const response = await requestJson(
      apiUrl(baseUrl, `/api/websites/${websiteId}/events/stats`, {
        startAt: range.startAt,
        endAt: range.endAt,
        compare: 'prev',
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
    limit: 500,
  })
  return derivedMetric(rows.reduce((total, row) => total + Number(row.y || 0), 0))
}

export async function fetchUmamiDashboard({
  projectKey,
  period = '30d',
  env = process.env,
  now = new Date(),
  fetchImpl = fetch,
  timeoutMs = 8_000,
  summaryOnly = false,
}) {
  const project = getAnalyticsProject(projectKey, env)
  const baseUrl = env.STAT_REPORT_UMAMI_URL?.trim()
  const username = env.STAT_REPORT_UMAMI_USERNAME?.trim() || 'admin'
  const password = env.STAT_REPORT_UMAMI_PASSWORD?.trim()
  const range = getAnalyticsRange(period, now)

  if (!baseUrl || !password) {
    return {
      status: 'configuration_error',
      project,
      range,
      message: 'Faltan STAT_REPORT_UMAMI_URL o STAT_REPORT_UMAMI_PASSWORD en Coolify.',
    }
  }

  const token = await authenticate({ baseUrl, username, password, fetchImpl, timeoutMs })
  const websiteId = await resolveWebsiteId({ baseUrl, token, project, fetchImpl, timeoutMs })
  if (!websiteId) {
    return {
      status: 'configuration_error',
      project,
      range,
      message: `No se encontró el sitio en Umami. Configura ${project.websiteIdEnv} en Coolify.`,
    }
  }

  const baseParams = { startAt: range.startAt, endAt: range.endAt }
  const corePromise = Promise.allSettled([
    requestJson(apiUrl(baseUrl, `/api/websites/${websiteId}/active`), { token, fetchImpl, timeoutMs }),
    requestJson(apiUrl(baseUrl, `/api/websites/${websiteId}/stats`, baseParams), { token, fetchImpl, timeoutMs }),
    requestJson(apiUrl(baseUrl, `/api/websites/${websiteId}/pageviews`, {
      ...baseParams,
      unit: range.unit,
      timezone: 'Europe/Madrid',
    }), { token, fetchImpl, timeoutMs }),
    fetchEventSummary({ baseUrl, websiteId, token, range, fetchImpl, timeoutMs }),
  ])
  const metricsPromise = summaryOnly
    ? Promise.resolve({})
    : Promise.allSettled([
        fetchMetric({ baseUrl, websiteId, token, range, types: ['url', 'path'], fetchImpl, timeoutMs }),
        ...Object.values(METRIC_TYPES).map((types) => (
          fetchMetric({ baseUrl, websiteId, token, range, types, fetchImpl, timeoutMs })
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

  const [[activeResult, statsResult, pageviewsResult, eventsResult], metrics] = await Promise.all([
    corePromise,
    metricsPromise,
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
    range,
    generatedAt: now.toISOString(),
    activeVisitors: activeResult.status === 'fulfilled' ? Number(activeResult.value?.visitors || 0) : null,
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
  }
}
