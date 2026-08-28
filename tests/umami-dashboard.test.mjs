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
import { getSuperEntrenadorNavigation, isNavigationItemActive } from '../src/lib/data/superentrenador-navigation.mjs'
import { buildChartPoints } from '../src/lib/data/analytics-chart.mjs'

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
