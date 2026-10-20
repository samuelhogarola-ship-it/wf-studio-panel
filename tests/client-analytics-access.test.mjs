import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import * as analyticsDashboard from '../src/lib/analytics/umami-dashboard.mjs'
import {
  loadProjectModule,
  database,
  project,
  capability,
  client,
  clientId,
  otherClientId,
} from './helpers/project-harness.mjs'

const routePath = 'src/app/api/analytics/[project]/route.ts'
const pagePath = 'src/app/cliente/(protected)/proyectos/[slug]/estadisticas/page.tsx'
const configuredProject = {
  ...project,
  slug: 'my-site',
  name: 'My Site',
  domain: 'webfuengirola.com',
  analytics_registry_key: 'webfuengirola',
}
const activeAnalytics = {
  ...capability,
  capability_key: 'analytics',
  state: 'active',
  project_id: configuredProject.id,
}

function analyticsResult(projectKey = 'webfuengirola') {
  return {
    status: 'ok',
    project: {
      key: projectKey,
      label: 'Web Fuengirola',
      domain: 'webfuengirola.com',
      websiteIdEnv: 'UMAMI_WEBSITE_ID_WEBFUENGIROLA',
      websiteId: 'private-website-id',
    },
    websiteId: 'private-website-id',
    range: { key: '30d', label: 'Últimos 30 días', startAt: 1, endAt: 2, unit: 'day' },
    generatedAt: '2026-10-17T12:00:00.000Z',
    activeVisitors: 1,
    summary: {},
    series: { pageviews: [], visitors: [] },
    metrics: {},
  }
}

function setup({
  role = 'client',
  optionalIdentity = role ? { userId: 'session-user', email: client.email, role } : null,
  projects = [configuredProject],
  capabilities = [activeAnalytics],
  configuredAnalytics = true,
  useRealDashboard = false,
  result = analyticsResult(),
  error = null,
  locale = 'es',
} = {}) {
  const db = database({ client_projects: projects, project_capabilities: capabilities })
  const analyticsCalls = []
  const identity = { userId: 'session-user', email: client.email, role: 'client', client: { ...client, portal_mode: 'dynamic' } }
  const configuredSites = configuredAnalytics
    ? [{ key: 'webfuengirola', domain: 'webfuengirola.com', websiteId: 'private-website-id', source: 'personal' }]
    : []
  const mocks = {
    '@/lib/auth': {
      getOptionalIdentity: async () => optionalIdentity,
      requireAdmin: async () => ({ userId: 'admin-id', email: 'admin@example.com', role: 'admin' }),
      requireClientAccess: async () => identity,
    },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => db },
    '@/lib/analytics/umami-core.mjs': {
      getConfiguredUmamiSites: () => configuredSites,
      getUmamiConnections: () => ({ personal: { baseUrl: 'https://stats.example.test', password: 'server-secret' } }),
    },
    '@/lib/analytics/umami-dashboard.mjs': useRealDashboard ? analyticsDashboard : {
      ...analyticsDashboard,
      async fetchUmamiDashboard(options) {
        analyticsCalls.push(options)
        if (error) throw error
        return result
      },
    },
    '@/lib/locale': { getLocale: async () => locale },
    'next/navigation': {
      notFound() { throw new Error('404') },
      redirect(url) { throw new Error(`redirect:${url}`) },
    },
  }
  const load = relative => loadProjectModule(relative, mocks)
  const request = async (projectSlug, query = '') => {
    const route = load(routePath)
    const response = await route.GET(
      new Request(`https://studio.example.test/api/analytics/${projectSlug}${query}`),
      { params: Promise.resolve({ project: projectSlug }) },
    )
    return { response, payload: await response.json() }
  }
  return { db, analyticsCalls, load, request }
}

test('an authorized client uses its project slug while the server resolves the registry key', async () => {
  const s = setup()
  const { response, payload } = await s.request('my-site', '?period=7d')

  assert.equal(response.status, 200)
  assert.equal(s.analyticsCalls.length, 1)
  assert.equal(s.analyticsCalls[0].projectKey, 'webfuengirola')
  assert.equal(s.analyticsCalls[0].period, '7d')
  assert.equal(payload.status, 'ok')
  assert.equal(JSON.stringify(payload).includes('webfuengirola'), false)
  assert.equal(JSON.stringify(payload).includes('private-website-id'), false)
  assert.equal(JSON.stringify(payload).includes('UMAMI_'), false)
})

test('a client cannot choose a registry key directly', async () => {
  const s = setup()
  const { response, payload } = await s.request('webfuengirola')

  assert.equal(response.status, 404)
  assert.deepEqual(payload, { status: 'error', message: 'Estadísticas no disponibles.' })
  assert.deepEqual(s.analyticsCalls, [])
})

test('unknown, cross-client, inactive and misconfigured client targets are indistinguishable', async () => {
  const cases = [
    setup(),
    setup({ projects: [{ ...configuredProject, client_id: otherClientId }] }),
    setup({ capabilities: [{ ...activeAnalytics, state: 'available' }] }),
    setup({ configuredAnalytics: false }),
  ]
  const slugs = ['unknown', 'my-site', 'my-site', 'my-site']
  const outcomes = []

  for (let index = 0; index < cases.length; index += 1) {
    const { response, payload } = await cases[index].request(slugs[index])
    outcomes.push({ status: response.status, payload })
    assert.deepEqual(cases[index].analyticsCalls, [])
  }

  assert.deepEqual(outcomes, Array.from({ length: 4 }, () => ({
    status: 404,
    payload: { status: 'error', message: 'Estadísticas no disponibles.' },
  })))
})

test('authentication happens before project or analytics reads', async () => {
  const s = setup({ role: null })
  const { response } = await s.request('my-site')

  assert.equal(response.status, 401)
  assert.deepEqual(s.db.calls, [])
  assert.deepEqual(s.analyticsCalls, [])
})

test('administrator analytics requests resolve the exact project registry key', async () => {
  const s = setup({ role: 'admin' })
  const { response } = await s.request(configuredProject.id)

  assert.equal(response.status, 200)
  assert.deepEqual(s.analyticsCalls.map(call => call.projectKey), ['webfuengirola'])
})

test('administrator requests reject unknown project ids before analytics access', async () => {
  const s = setup({ role: 'admin', useRealDashboard: true })
  const missingProjectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const { response, payload } = await s.request(missingProjectId)

  assert.equal(response.status, 404)
  assert.deepEqual(payload, {
    status: 'error',
    message: `Proyecto de estadísticas desconocido: ${missingProjectId}`,
  })
  assert.deepEqual(s.analyticsCalls, [])
})

test('administrators retain the raw upstream Umami diagnostic and 502 status', async () => {
  const diagnostic = 'Umami respondió HTTP 503: conexión personal no disponible'
  const s = setup({ role: 'admin', error: new Error(diagnostic) })
  const { response, payload } = await s.request(configuredProject.id)

  assert.equal(response.status, 502)
  assert.deepEqual(payload, { status: 'error', message: diagnostic })
})

test('upstream failures and client configuration errors never expose operational details', async () => {
  const upstream = setup({ error: new Error('https://umami.internal token=secret HTTP 503') })
  const failed = await upstream.request('my-site')
  assert.equal(failed.response.status, 502)
  assert.deepEqual(failed.payload, { status: 'error', message: 'No se pudieron cargar las estadísticas.' })

  const configuration = setup({ result: {
    status: 'configuration_error',
    project: analyticsResult().project,
    range: analyticsResult().range,
    message: 'Configura UMAMI_PASSWORD=secret en Coolify.',
  } })
  const pending = await configuration.request('my-site')
  assert.equal(pending.response.status, 200)
  assert.deepEqual(pending.payload, {
    status: 'configuration_error',
    range: analyticsResult().range,
    message: 'Las estadísticas todavía no están disponibles.',
  })
  assert.doesNotMatch(JSON.stringify([failed.payload, pending.payload]), /umami|secret|coolify|http/i)
})

test('the statistics page authorizes the active capability and sends only the slug to the panel', async () => {
  assert.ok(existsSync(new URL(`../${pagePath}`, import.meta.url)), 'statistics page must exist')
  const s = setup({ locale: 'en' })
  const Page = s.load(pagePath).default
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ slug: 'my-site' }) }))

  assert.match(html, /Statistics · My Site/)
  assert.match(html, /webfuengirola\.com/)
  assert.match(html, /my-site-analytics-title/)
  assert.doesNotMatch(html, /private-website-id|UMAMI_|server-secret|\/api\/analytics\/webfuengirola/)
})

test('the statistics page returns the same 404 for inaccessible capability states', async () => {
  assert.ok(existsSync(new URL(`../${pagePath}`, import.meta.url)), 'statistics page must exist')
  for (const s of [
    setup({ projects: [] }),
    setup({ projects: [{ ...configuredProject, client_id: otherClientId }] }),
    setup({ capabilities: [{ ...activeAnalytics, state: 'available' }] }),
    setup({ configuredAnalytics: false }),
  ]) {
    const Page = s.load(pagePath).default
    await assert.rejects(() => Page({ params: Promise.resolve({ slug: 'my-site' }) }), { message: '404' })
  }
})
