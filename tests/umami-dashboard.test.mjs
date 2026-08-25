import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ANALYTICS_PROJECTS,
  createRequestCoordinator,
  fetchUmamiDashboard,
  getAnalyticsProject,
  getAnalyticsRange,
  normalizePeriod,
} from '../src/lib/analytics/umami-dashboard.mjs'

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
