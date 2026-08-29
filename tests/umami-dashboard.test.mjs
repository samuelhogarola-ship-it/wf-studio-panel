import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildUmamiDashboard,
  createTtlCache,
  formatTrend,
  getMissingUmamiConfig,
  numberValue,
  parseAnalyticsDays,
  previousValue,
  statsCurrentValue,
  statsPreviousValue,
} from '../src/lib/data/umami-core.mjs'
import { getSuperEntrenadorNavigation, isNavigationItemActive } from '../src/lib/data/superentrenador-navigation.mjs'
import { buildChartPoints } from '../src/lib/data/analytics-chart.mjs'
import {
  ANALYTICS_PROJECTS,
  createRequestCoordinator,
  fetchUmamiDashboard,
  getAnalyticsProject,
  getAnalyticsRange,
  normalizePeriod,
} from '../src/lib/analytics/umami-dashboard.mjs'

test('TTL cache reuses complete dashboard loads and retries failures', async () => {
  let now = 1_000
  let loads = 0
  const cached = createTtlCache({ ttlMs: 300, now: () => now })
  const load = async () => ({ load: ++loads })

  assert.deepEqual(await cached('30', load), { load: 1 })
  assert.deepEqual(await cached('30', load), { load: 1 })
  now = 1_301
  assert.deepEqual(await cached('30', load), { load: 2 })

  await assert.rejects(cached('90', async () => { throw new Error('temporary') }), /temporary/)
  assert.deepEqual(await cached('90', load), { load: 3 })
})

test('chart points scale values safely and handle an empty series', () => {
  assert.deepEqual(buildChartPoints([], 100, 40), [])
  assert.deepEqual(
    buildChartPoints([{ x: 'a', y: 0 }, { x: 'b', y: 10 }, { x: 'c', y: 5 }], 100, 40),
    [{ x: 0, y: 40 }, { x: 50, y: 0 }, { x: 100, y: 20 }],
  )
})

test('Superentrenador navigation exposes statistics as its landing page', () => {
  assert.deepEqual(getSuperEntrenadorNavigation('/paneladmin/superentrenador/usuarios'), [
    { href: '/paneladmin/superentrenador/estadisticas', label: 'Estadísticas', active: false },
    { href: '/paneladmin/superentrenador/pt', label: 'Entrenadores', active: false },
    { href: '/paneladmin/superentrenador/usuarios', label: 'Usuarios', active: true },
  ])
})

test('sidebar section remains active on every Superentrenador route', () => {
  for (const path of [
    '/paneladmin/superentrenador/estadisticas',
    '/paneladmin/superentrenador/pt',
    '/paneladmin/superentrenador/usuarios',
  ]) {
    assert.equal(
      isNavigationItemActive(path, '/paneladmin/superentrenador/estadisticas', '/paneladmin/superentrenador'),
      true,
    )
  }
  assert.equal(
    isNavigationItemActive('/paneladmin/samuel-coach', '/paneladmin/superentrenador/estadisticas', '/paneladmin/superentrenador'),
    false,
  )
})

test('configuration reports every missing server credential', () => {
  assert.deepEqual(
    getMissingUmamiConfig({
      UMAMI_URL: 'https://analytics.example.com',
      UMAMI_USERNAME: '',
      UMAMI_PASSWORD: undefined,
      UMAMI_SUPERENTRENADOR_WEBSITE_ID: 'site-1',
    }),
    ['UMAMI_USERNAME', 'UMAMI_PASSWORD'],
  )
})

test('analytics periods accept 7, 30, and 90 days and default to 30', () => {
  assert.equal(parseAnalyticsDays('7'), 7)
  assert.equal(parseAnalyticsDays('90'), 90)
  assert.equal(parseAnalyticsDays('0'), 30)
  assert.equal(parseAnalyticsDays('anything'), 30)
  assert.equal(parseAnalyticsDays(undefined), 30)
})

test('Umami scalar and comparison metrics normalize to current and previous values', () => {
  assert.equal(numberValue(12), 12)
  assert.equal(numberValue({ value: 8, prev: 5 }), 8)
  assert.equal(numberValue(null), 0)
  assert.equal(previousValue({ value: 8, prev: 5 }), 5)
  assert.equal(previousValue(12), 0)
})

test('current and legacy Umami stats shapes both expose prior-period values', () => {
  const current = { visits: 60, comparison: { visits: 50 } }
  const legacy = { visits: { value: 60, prev: 50 } }
  assert.equal(statsCurrentValue(current, 'visits'), 60)
  assert.equal(statsPreviousValue(current, 'visits'), 50)
  assert.equal(statsCurrentValue(legacy, 'visits'), 60)
  assert.equal(statsPreviousValue(legacy, 'visits'), 50)
})

test('trend formatting handles growth, decline, new traffic, and no change', () => {
  assert.equal(formatTrend(15, 10), '+50%')
  assert.equal(formatTrend(5, 10), '-50%')
  assert.equal(formatTrend(3, 0), 'Nuevo')
  assert.equal(formatTrend(0, 0), '—')
})

test('dashboard fetches and derives the complete Umami summary without exposing credentials', async () => {
  const requests = []
  const fixtures = {
    '/api/auth/login': { token: 'secret-token' },
    '/stats': {
      pageviews: 120,
      visitors: 50,
      visits: 60,
      bounces: 15,
      totaltime: 7200,
      comparison: { pageviews: 100, visitors: 40, visits: 50, bounces: 10, totaltime: 5000 },
    },
    '/pageviews': { pageviews: [{ x: '2026-08-27', y: 12 }], sessions: [{ x: '2026-08-27', y: 8 }] },
  }
  const metrics = {
    path: [{ x: '/', y: 70 }],
    referrer: [{ x: 'google.com', y: 30 }],
    country: [{ x: 'ES', y: 45 }],
    device: [{ x: 'mobile', y: 35 }],
    event: [{ x: 'mensaje-enviado', y: 4 }, { x: 'premium-cta', y: 2 }],
  }

  const fetchImpl = async (input, init = {}) => {
    const url = new URL(String(input))
    requests.push({ url, init })
    if (url.pathname === '/api/auth/login') {
      return Response.json(fixtures['/api/auth/login'])
    }
    const suffix = url.pathname.replace('/api/websites/site-1', '')
    if (suffix === '/metrics') return Response.json(metrics[url.searchParams.get('type')])
    return Response.json(fixtures[suffix])
  }

  const result = await buildUmamiDashboard({
    config: { baseUrl: 'https://analytics.example.com/', username: 'admin', password: 'do-not-leak', websiteId: 'site-1' },
    days: 30,
    now: new Date('2026-08-28T12:00:00.000Z'),
    fetchImpl,
  })

  assert.deepEqual(result.summary, {
    pageviews: { value: 120, previous: 100, trend: '+20%' },
    visitors: { value: 50, previous: 40, trend: '+25%' },
    visits: { value: 60, previous: 50, trend: '+20%' },
    bounceRate: { value: 25, previous: 20, trend: '+25%' },
    averageVisitSeconds: { value: 120, previous: 100, trend: '+20%' },
  })
  assert.deepEqual(result.series.pageviews, fixtures['/pageviews'].pageviews)
  assert.deepEqual(result.topPages, metrics.path)
  assert.equal(result.funnel['mensaje-enviado'], 4)
  assert.equal(result.funnel['contacto-iniciar-sesion'], 0)
  assert.equal(requests.length, 8)
  assert.equal(requests.some(({ url }) => url.searchParams.get('type') === 'path'), true)
  assert.match(requests[1].init.headers.Authorization, /^Bearer /)
  assert.equal(JSON.stringify(result).includes('do-not-leak'), false)
})

test('upstream failure reports the endpoint and status without leaking the password', async () => {
  const fetchImpl = async (input) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/auth/login') return Response.json({ token: 'token' })
    return new Response('secret upstream body', { status: 503 })
  }

  await assert.rejects(
    buildUmamiDashboard({
      config: { baseUrl: 'https://analytics.example.com', username: 'admin', password: 'do-not-leak', websiteId: 'site-1' },
      days: 7,
      now: new Date('2026-08-28T12:00:00.000Z'),
      fetchImpl,
    }),
    (error) => {
      assert.match(error.message, /503/)
      assert.equal(error.message.includes('do-not-leak'), false)
      assert.equal(error.message.includes('secret upstream body'), false)
      return true
    },
  )
})
test('analytics ranges offer live data and historical periods up to one year', () => {
  const now = new Date('2026-08-25T12:00:00.000Z')

  assert.deepEqual(getAnalyticsRange('live', now), {
    key: 'live',
    label: 'Últimas 24 horas',
    startAt: Date.parse('2026-08-24T12:00:00.000Z'),
    endAt: Date.parse('2026-08-25T12:00:00.000Z'),
    unit: 'hour',
  })
  assert.equal(getAnalyticsRange('12m', now).startAt, Date.parse('2025-08-25T12:00:00.000Z'))
  assert.equal(getAnalyticsRange('12m', now).unit, 'month')
  assert.equal(normalizePeriod('90d'), '90d')
  assert.equal(normalizePeriod('18m'), '30d')
})

test('calendar ranges clamp month-end and leap-day boundaries', () => {
  assert.equal(
    getAnalyticsRange('6m', new Date('2024-08-31T12:00:00.000Z')).startAt,
    Date.parse('2024-02-29T12:00:00.000Z'),
  )
  assert.equal(
    getAnalyticsRange('12m', new Date('2024-02-29T12:00:00.000Z')).startAt,
    Date.parse('2023-02-28T12:00:00.000Z'),
  )
})

test('request coordinator aborts stale work and only accepts the latest response', () => {
  const coordinator = createRequestCoordinator()
  const first = coordinator.next()
  const second = coordinator.next()

  assert.equal(first.signal.aborted, true)
  assert.equal(first.isLatest(), false)
  assert.equal(second.signal.aborted, false)
  assert.equal(second.isLatest(), true)
  coordinator.abort()
  assert.equal(second.signal.aborted, true)
})

test('analytics project registry covers every WF Panel project and explains missing ids', () => {
  assert.deepEqual(
    ANALYTICS_PROJECTS.map((project) => project.key),
    [
      'webfuengirola',
      'vivirenfuengirola',
      'conocef',
      'samuelcoachdealeman',
      'vokabelworld',
      'superentrenador',
      'agama',
    ],
  )

  const configured = getAnalyticsProject('superentrenador', {
    STAT_REPORT_UMAMI_WEBSITE_ID_SUPERENTRENADOR: 'super-id',
  })
  assert.equal(configured.websiteId, 'super-id')
  assert.equal(configured.websiteIdEnv, 'STAT_REPORT_UMAMI_WEBSITE_ID_SUPERENTRENADOR')

  const missing = getAnalyticsProject('agama', {})
  assert.equal(missing.websiteId, undefined)
  assert.equal(missing.websiteIdEnv, 'STAT_REPORT_UMAMI_WEBSITE_ID_AGAMA')
})

test('dashboard resolves website id and returns all supported Umami dimensions', async () => {
  const requests = []
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(String(input))
    requests.push(`${options.method || 'GET'} ${url.pathname}?${url.searchParams}`)

    if (url.pathname === '/api/auth/login') {
      return jsonResponse({ token: 'token' })
    }
    if (url.pathname === '/api/websites') {
      return jsonResponse({ data: [{ id: 'wf-id', name: 'Web Fuengirola', domain: 'webfuengirola.com' }] })
    }
    if (url.pathname.endsWith('/active')) {
      return jsonResponse({ visitors: 3 })
    }
    if (url.pathname.endsWith('/events/stats')) {
      return jsonResponse({ data: { events: 7, comparison: { events: 5 } } })
    }
    if (url.pathname.endsWith('/stats')) {
      return jsonResponse({
        pageviews: { value: 120, prev: 100 },
        visitors: { value: 40, prev: 50 },
        visits: { value: 60, prev: 55 },
        bounces: { value: 18, prev: 20 },
        totaltime: { value: 3600, prev: 3000 },
      })
    }
    if (url.pathname.endsWith('/pageviews')) {
      return jsonResponse({
        pageviews: [{ x: '2026-08-25T10:00:00Z', y: 12 }],
        sessions: [{ x: '2026-08-25T10:00:00Z', y: 5 }],
      })
    }
    if (url.pathname.endsWith('/metrics')) {
      const type = url.searchParams.get('type')
      if (type === 'path') return jsonResponse({ message: 'unsupported' }, 400)
      return jsonResponse([{ x: `${type}-value`, y: 7 }])
    }
    return jsonResponse({ message: 'not found' }, 404)
  }

  const dashboard = await fetchUmamiDashboard({
    projectKey: 'webfuengirola',
    period: 'live',
    env: {
      STAT_REPORT_UMAMI_URL: 'https://analytics.example.com',
      STAT_REPORT_UMAMI_USERNAME: 'admin',
      STAT_REPORT_UMAMI_PASSWORD: 'secret',
    },
    now: new Date('2026-08-25T12:00:00.000Z'),
    fetchImpl,
  })

  assert.equal(dashboard.status, 'ok')
  assert.equal(dashboard.websiteId, 'wf-id')
  assert.equal(dashboard.activeVisitors, 3)
  assert.equal(dashboard.summary.pageviews.value, 120)
  assert.equal(dashboard.summary.pageviews.change, 20)
  assert.equal(dashboard.summary.bounceRate.value, 30)
  assert.equal(dashboard.summary.averageVisitSeconds.value, 60)
  assert.equal(dashboard.summary.pagesPerVisit.value, 2)
  assert.equal(dashboard.summary.events.value, 7)
  assert.deepEqual(dashboard.series.pageviews, [{ x: '2026-08-25T10:00:00Z', y: 12 }])
  assert.equal(dashboard.metrics.pages[0].x, 'url-value')
  assert.equal(dashboard.metrics.entries[0].x, 'entry-value')
  assert.equal(dashboard.metrics.cities[0].x, 'city-value')
  assert.equal(dashboard.metrics.events[0].x, 'event-value')
  assert.ok(requests.some((request) => request.includes('/api/websites?')))
})

test('dashboard keeps working when optional metrics are unsupported', async () => {
  const fetchImpl = async (input) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/auth/login') return jsonResponse({ token: 'token' })
    if (url.pathname.endsWith('/active')) return jsonResponse({ visitors: 0 })
    if (url.pathname.endsWith('/events/stats')) return jsonResponse({ message: 'unsupported' }, 404)
    if (url.pathname.endsWith('/stats')) {
      return jsonResponse({ pageviews: 0, visitors: 0, visits: 0, bounces: 0, totaltime: 0 })
    }
    if (url.pathname.endsWith('/pageviews')) return jsonResponse({ pageviews: [], sessions: [] })
    if (url.pathname.endsWith('/metrics')) return jsonResponse({ message: 'unsupported' }, 400)
    return jsonResponse({ message: 'not found' }, 404)
  }

  const dashboard = await fetchUmamiDashboard({
    projectKey: 'agama',
    period: '12m',
    env: {
      STAT_REPORT_UMAMI_URL: 'https://analytics.example.com',
      STAT_REPORT_UMAMI_PASSWORD: 'secret',
      STAT_REPORT_UMAMI_WEBSITE_ID_AGAMA: 'agama-id',
    },
    fetchImpl,
  })

  assert.equal(dashboard.status, 'ok')
  assert.deepEqual(dashboard.metrics.pages, [])
  assert.deepEqual(dashboard.metrics.countries, [])
  assert.equal(dashboard.summary.bounceRate.value, 0)
})

test('summary refresh skips dimension requests and uses the exact event count', async () => {
  const requestedMetricTypes = []
  const fetchImpl = async (input) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/auth/login') return jsonResponse({ token: 'token' })
    if (url.pathname.endsWith('/active')) return jsonResponse({ visitors: 2 })
    if (url.pathname.endsWith('/events/stats')) {
      return jsonResponse({ data: { events: 37, comparison: { events: 29 } } })
    }
    if (url.pathname.endsWith('/stats')) {
      return jsonResponse({ pageviews: 20, visitors: 8, visits: 10, bounces: 4, totaltime: 300 })
    }
    if (url.pathname.endsWith('/pageviews')) return jsonResponse({ pageviews: [], sessions: [] })
    if (url.pathname.endsWith('/metrics')) {
      requestedMetricTypes.push(url.searchParams.get('type'))
      return jsonResponse([])
    }
    return jsonResponse({ message: 'not found' }, 404)
  }

  const dashboard = await fetchUmamiDashboard({
    projectKey: 'superentrenador',
    period: 'live',
    summaryOnly: true,
    env: {
      STAT_REPORT_UMAMI_URL: 'https://analytics.example.com',
      STAT_REPORT_UMAMI_PASSWORD: 'secret',
      STAT_REPORT_UMAMI_WEBSITE_ID_SUPERENTRENADOR: 'super-id',
    },
    fetchImpl,
  })

  assert.equal(dashboard.status, 'ok')
  assert.equal(dashboard.summary.events.value, 37)
  assert.equal(dashboard.summary.events.previous, 29)
  assert.deepEqual(dashboard.metrics, {})
  assert.deepEqual(requestedMetricTypes, [])
})

test('event summary falls back to the v2 event metric without counting pageviews', async () => {
  const fetchImpl = async (input) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/auth/login') return jsonResponse({ token: 'token' })
    if (url.pathname.endsWith('/active')) return jsonResponse({ visitors: 1 })
    if (url.pathname.endsWith('/events/stats')) return jsonResponse({ message: 'unsupported' }, 404)
    if (url.pathname.endsWith('/stats')) return jsonResponse({ pageviews: 50, visitors: 10, visits: 12, bounces: 2, totaltime: 200 })
    if (url.pathname.endsWith('/pageviews')) return jsonResponse({ pageviews: [], sessions: [] })
    if (url.pathname.endsWith('/metrics') && url.searchParams.get('type') === 'event') {
      return jsonResponse([{ x: 'signup', y: 4 }, { x: 'purchase', y: 2 }])
    }
    return jsonResponse({ message: 'not found' }, 404)
  }

  const dashboard = await fetchUmamiDashboard({
    projectKey: 'agama',
    period: 'live',
    summaryOnly: true,
    env: {
      STAT_REPORT_UMAMI_URL: 'https://analytics.v2.example.com',
      STAT_REPORT_UMAMI_PASSWORD: 'secret',
      STAT_REPORT_UMAMI_WEBSITE_ID_AGAMA: 'agama-id',
    },
    fetchImpl,
  })

  assert.equal(dashboard.status, 'ok')
  assert.equal(dashboard.summary.events.value, 6)
})

test('dashboard fails within the configured timeout when Umami hangs', async () => {
  const fetchImpl = async () => new Promise(() => {})

  await assert.rejects(
    fetchUmamiDashboard({
      projectKey: 'webfuengirola',
      env: {
        STAT_REPORT_UMAMI_URL: 'https://analytics.example.com',
        STAT_REPORT_UMAMI_PASSWORD: 'secret',
        STAT_REPORT_UMAMI_WEBSITE_ID_WEBFUENGIROLA: 'wf-id',
      },
      fetchImpl,
      timeoutMs: 10,
    }),
    /tiempo de espera/i,
  )
})

test('dashboard reuses authentication and resolved website ids between refreshes', async () => {
  let logins = 0
  let websiteLists = 0
  const fetchImpl = async (input) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/auth/login') {
      logins += 1
      return jsonResponse({ token: 'cached-token' })
    }
    if (url.pathname === '/api/websites') {
      websiteLists += 1
      return jsonResponse({ data: [{ id: 'wf-id', name: 'Web Fuengirola', domain: 'webfuengirola.com' }] })
    }
    if (url.pathname.endsWith('/active')) return jsonResponse({ visitors: 1 })
    if (url.pathname.endsWith('/events/stats')) return jsonResponse({ data: { events: 0 } })
    if (url.pathname.endsWith('/stats')) return jsonResponse({ pageviews: 1, visitors: 1, visits: 1, bounces: 0, totaltime: 1 })
    if (url.pathname.endsWith('/pageviews')) return jsonResponse({ pageviews: [], sessions: [] })
    return jsonResponse({ message: 'not found' }, 404)
  }
  const options = {
    projectKey: 'webfuengirola',
    period: 'live',
    summaryOnly: true,
    env: {
      STAT_REPORT_UMAMI_URL: 'https://analytics.cache-test.example.com',
      STAT_REPORT_UMAMI_PASSWORD: 'secret',
    },
    fetchImpl,
  }

  await fetchUmamiDashboard(options)
  await fetchUmamiDashboard(options)

  assert.equal(logins, 1)
  assert.equal(websiteLists, 1)
})

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
