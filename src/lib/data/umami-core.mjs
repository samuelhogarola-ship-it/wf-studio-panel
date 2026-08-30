const ALLOWED_DAYS = new Set([7, 30, 90])
const CONFIG_ALIASES = [
  ['UMAMI_PERSONAL_URL', 'UMAMI_URL'],
  ['UMAMI_PERSONAL_USERNAME', 'UMAMI_USERNAME'],
  ['UMAMI_PERSONAL_PASSWORD', 'UMAMI_PASSWORD'],
  ['UMAMI_WEBSITE_ID_SUPERENTRENADOR', 'UMAMI_SUPERENTRENADOR_WEBSITE_ID'],
]

export function createTtlCache({ ttlMs, now = Date.now }) {
  const entries = new Map()
  return async (key, load) => {
    const existing = entries.get(key)
    if (existing && existing.expiresAt > now()) return existing.promise

    const promise = Promise.resolve().then(load)
    const entry = { expiresAt: now() + ttlMs, promise }
    entries.set(key, entry)
    try {
      return await promise
    } catch (error) {
      if (entries.get(key) === entry) entries.delete(key)
      throw error
    }
  }
}

export function getMissingUmamiConfig(env) {
  const usingLegacy = CONFIG_ALIASES.some(([, legacy]) => env[legacy]?.trim())
  return CONFIG_ALIASES
    .filter(([preferred, legacy]) => !env[preferred]?.trim() && !env[legacy]?.trim())
    .map(([preferred, legacy]) => usingLegacy ? legacy : preferred)
}

export function getSuperEntrenadorUmamiConfig(env) {
  return {
    baseUrl: env.UMAMI_PERSONAL_URL?.trim() || env.UMAMI_URL?.trim(),
    username: env.UMAMI_PERSONAL_USERNAME?.trim() || env.UMAMI_USERNAME?.trim(),
    password: env.UMAMI_PERSONAL_PASSWORD?.trim() || env.UMAMI_PASSWORD?.trim(),
    websiteId: env.UMAMI_WEBSITE_ID_SUPERENTRENADOR?.trim() || env.UMAMI_SUPERENTRENADOR_WEBSITE_ID?.trim(),
  }
}

export function parseAnalyticsDays(value) {
  const days = Number(value)
  return ALLOWED_DAYS.has(days) ? days : 30
}

export function numberValue(metric) {
  if (typeof metric === 'number') return Number.isFinite(metric) ? metric : 0
  if (metric && typeof metric.value === 'number') return metric.value
  return 0
}

export function previousValue(metric) {
  if (metric && typeof metric === 'object' && typeof metric.prev === 'number') return metric.prev
  return 0
}

export function statsCurrentValue(stats, name) {
  return numberValue(stats?.[name])
}

export function statsPreviousValue(stats, name) {
  const comparison = stats?.comparison?.[name]
  return typeof comparison === 'number' ? comparison : previousValue(stats?.[name])
}

export function formatTrend(current, previous) {
  if (!previous) return current ? 'Nuevo' : '—'
  const change = Math.round(((current - previous) / previous) * 100)
  if (!change) return '—'
  return `${change > 0 ? '+' : ''}${change}%`
}

export class UmamiRequestError extends Error {
  constructor(endpoint, status) {
    super(`Umami request ${endpoint} failed with status ${status}`)
    this.name = 'UmamiRequestError'
    this.endpoint = endpoint
    this.status = status
  }
}

function metric(current, previous) {
  return { value: current, previous, trend: formatTrend(current, previous) }
}

async function requestJson(url, init, fetchImpl, endpoint) {
  const response = await fetchImpl(url, init)
  if (!response.ok) throw new UmamiRequestError(endpoint, response.status)
  return response.json()
}

export async function buildUmamiDashboard({ config, days, now = new Date(), fetchImpl = fetch }) {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const login = await requestJson(
    `${baseUrl}/api/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: config.username, password: config.password }),
      cache: 'no-store',
    },
    fetchImpl,
    '/api/auth/login',
  )
  if (!login?.token) throw new UmamiRequestError('/api/auth/login', 502)

  const endAt = now.getTime()
  const startAt = endAt - days * 24 * 60 * 60 * 1000
  const headers = { Authorization: `Bearer ${login.token}` }
  const get = (endpoint, params = {}) => {
    const url = new URL(`${baseUrl}/api/websites/${config.websiteId}${endpoint}`)
    for (const [key, value] of Object.entries({ startAt, endAt, ...params })) {
      url.searchParams.set(key, String(value))
    }
    return requestJson(url, { headers, next: { revalidate: 300 } }, fetchImpl, endpoint)
  }

  const [stats, series, topPages, referrers, countries, devices, events] = await Promise.all([
    get('/stats', { compare: 'prev' }),
    get('/pageviews', { unit: 'day' }),
    get('/metrics', { type: 'path', limit: 10 }),
    get('/metrics', { type: 'referrer', limit: 10 }),
    get('/metrics', { type: 'country', limit: 10 }),
    get('/metrics', { type: 'device', limit: 10 }),
    get('/metrics', { type: 'event', limit: 20 }),
  ])

  const visits = statsCurrentValue(stats, 'visits')
  const previousVisits = statsPreviousValue(stats, 'visits')
  const bounceRate = visits ? Math.round((statsCurrentValue(stats, 'bounces') / visits) * 100) : 0
  const previousBounceRate = previousVisits ? Math.round((statsPreviousValue(stats, 'bounces') / previousVisits) * 100) : 0
  const averageVisitSeconds = visits ? Math.round(statsCurrentValue(stats, 'totaltime') / visits) : 0
  const previousAverageVisitSeconds = previousVisits ? Math.round(statsPreviousValue(stats, 'totaltime') / previousVisits) : 0
  const eventCounts = new Map((events ?? []).map((event) => [event.x, event.y]))
  const funnelNames = [
    'contacto-iniciar-sesion',
    'contacto-crear-cuenta',
    'mensaje-enviado',
    'entrenador-publicar-anuncio',
    'premium-cta',
  ]

  return {
    days,
    generatedAt: now.toISOString(),
    summary: {
      pageviews: metric(statsCurrentValue(stats, 'pageviews'), statsPreviousValue(stats, 'pageviews')),
      visitors: metric(statsCurrentValue(stats, 'visitors'), statsPreviousValue(stats, 'visitors')),
      visits: metric(visits, previousVisits),
      bounceRate: metric(bounceRate, previousBounceRate),
      averageVisitSeconds: metric(averageVisitSeconds, previousAverageVisitSeconds),
    },
    series: {
      pageviews: series?.pageviews ?? [],
      visits: series?.sessions ?? [],
    },
    funnel: Object.fromEntries(funnelNames.map((name) => [name, eventCounts.get(name) ?? 0])),
    topPages: topPages ?? [],
    referrers: referrers ?? [],
    countries: countries ?? [],
    devices: devices ?? [],
  }
}
