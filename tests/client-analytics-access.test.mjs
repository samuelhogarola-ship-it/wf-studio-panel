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
  clientAccessError = null,
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
      requireClientAccess: async () => {
        if (clientAccessError) throw clientAccessError
        return identity
      },
    },
    '@/lib/support/portal-viewer': {
      requirePortalViewer: async () => {
        if (clientAccessError) throw clientAccessError
        return { mode: 'client', identity, client: identity.client }
      },
      getOptionalSupportViewer: async () => null,
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

test('administrator browser requests cannot use a registry key as a project id', async () => {
  const s = setup({ role: 'admin' })
  const { response, payload } = await s.request('webfuengirola')

  assert.equal(response.status, 404)
  assert.deepEqual(payload, {
    status: 'error',
    message: 'Proyecto de estadísticas desconocido: webfuengirola',
  })
  assert.deepEqual(s.analyticsCalls, [])
})

test('administrator successful analytics responses omit operational configuration fields', async () => {
  const s = setup({ role: 'admin' })
  const { response, payload } = await s.request(configuredProject.id)

  assert.equal(response.status, 200)
  assert.deepEqual(payload, {
    status: 'ok',
    range: analyticsResult().range,
    generatedAt: '2026-10-17T12:00:00.000Z',
    activeVisitors: 1,
    summary: {},
    series: { pageviews: [], visitors: [] },
    metrics: {},
  })
  assert.doesNotMatch(JSON.stringify(payload), /webfuengirola|private-website-id|UMAMI_|server-secret/i)
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

test('the statistics page preserves authentication redirects and infrastructure failures', async () => {
  const s = setup({ clientAccessError: new Error('redirect:/acceso?next=%2Fcliente%2Fproyectos%2Fmy-site%2Festadisticas') })
  const Page = s.load(pagePath).default

  await assert.rejects(
    () => Page({ params: Promise.resolve({ slug: 'my-site' }) }),
    { message: 'redirect:/acceso?next=%2Fcliente%2Fproyectos%2Fmy-site%2Festadisticas' },
  )
})

test('home analytics summaries query only valid active tools and expose public values only', async () => {
  const calls = []
  const fetchDashboard = async (options) => {
    calls.push(options)
    return {
      ...analyticsResult(options.projectKey),
      summary: {
        pageviews: { value: 321 },
        visitors: { value: 123 },
        visits: { value: 210 },
      },
      metrics: {
        languages: [{ x: 'ru-RU', y: 999 }],
        contentLanguageEvents: [
          { x: 'page-language:es-ES', y: 4 },
          { x: 'page-language:es-MX', y: 3 },
          { x: 'page-language:en-US', y: 5 },
          { x: 'page-language:fi', y: 2 },
          { x: 'page-language:de-DE', y: 8 },
          { x: 'unrelated-event', y: 999 },
        ],
      },
    }
  }
  const { getClientAnalyticsSummaries } = loadProjectModule('src/lib/analytics/client-summary.ts', {
    '@/lib/data/projects': {
      getCapabilityConfigurationIssue: (candidate) => candidate.slug === 'misconfigured' ? 'analytics' : null,
    },
  })
  const valid = { ...configuredProject, capabilities: [activeAnalytics] }
  const projects = [
    valid,
    { ...valid, id: 'available', slug: 'available', analytics_registry_key: 'available-key', capabilities: [{ ...activeAnalytics, project_id: 'available', state: 'available' }] },
    { ...valid, id: 'inactive', slug: 'inactive', status: 'archived', analytics_registry_key: 'inactive-key' },
    { ...valid, id: 'hidden', slug: 'hidden', client_access_enabled: false, analytics_registry_key: 'hidden-key' },
    { ...valid, id: 'misconfigured', slug: 'misconfigured', analytics_registry_key: 'secret-registry-key' },
  ]

  const summaries = await getClientAnalyticsSummaries(projects, { fetchDashboard })

  assert.deepEqual(calls, [{ projectKey: 'webfuengirola', summaryOnly: true, includeContentLanguages: true }])
  assert.deepEqual(summaries, [{
    projectSlug: 'my-site',
    projectName: 'My Site',
    pageviews: 321,
    visitors: 123,
    visits: 210,
    languageTrafficTotal: 22,
    languages: [
      { code: 'de', label: 'Deutsch', value: 8, color: '#ef4444' },
      { code: 'es', label: 'Español', value: 7, color: '#22c55e' },
      { code: 'en', label: 'English', value: 5, color: '#3b82f6' },
    ],
  }])
  assert.doesNotMatch(JSON.stringify(summaries), /webfuengirola|secret-registry-key|website-id|UMAMI|credential/i)
})

test('Sport Massage language summary keeps Spanish red, English green and Finnish blue', async () => {
  const { getClientAnalyticsSummaries } = loadProjectModule('src/lib/analytics/client-summary.ts', {
    '@/lib/data/projects': { getCapabilityConfigurationIssue: () => null },
  })
  const sport = {
    ...configuredProject,
    slug: 'sportmassagefuengirola',
    name: 'Sport Massage',
    domain: 'sportmassagefuengirola.com',
    analytics_registry_key: 'sportmassagefuengirola',
    capabilities: [activeAnalytics],
  }

  const summaries = await getClientAnalyticsSummaries([sport], {
    fetchDashboard: async () => ({
      ...analyticsResult('sportmassagefuengirola'),
      summary: {},
      metrics: {
        contentLanguageEvents: [
          { x: 'page-language:de-DE', y: 100 },
          { x: 'page-language:en-US', y: 3 },
          { x: 'page-language:es-ES', y: 4 },
        ],
      },
    }),
  })

  assert.deepEqual(summaries[0].languages, [
    { code: 'es', label: 'Español', value: 4, color: '#ef4444' },
    { code: 'en', label: 'English', value: 3, color: '#22c55e' },
    { code: 'fi', label: 'Suomi', value: 0, color: '#3b82f6' },
  ])
  assert.equal(summaries[0].languageTrafficTotal, 7)
})

test('home analytics summaries isolate project failures and return an empty safe result on total failure', async () => {
  const { getClientAnalyticsSummaries } = loadProjectModule('src/lib/analytics/client-summary.ts', {
    '@/lib/data/projects': { getCapabilityConfigurationIssue: () => null },
  })
  const first = { ...configuredProject, capabilities: [activeAnalytics] }
  const second = {
    ...first,
    id: 'second-project',
    slug: 'second-site',
    name: 'Second Site',
    analytics_registry_key: 'second-registry',
    capabilities: [{ ...activeAnalytics, project_id: 'second-project' }],
  }
  const partial = await getClientAnalyticsSummaries([first, second], {
    fetchDashboard: async ({ projectKey }) => {
      if (projectKey === 'webfuengirola') throw new Error('https://umami.internal token=server-secret')
      return { ...analyticsResult(projectKey), summary: {
        pageviews: { value: 40 }, visitors: { value: 25 }, visits: { value: 30 },
      } }
    },
  })
  assert.deepEqual(partial, [{
    projectSlug: 'second-site',
    projectName: 'Second Site',
    pageviews: 40,
    visitors: 25,
    visits: 30,
    languageTrafficTotal: 0,
    languages: [],
  }])
  assert.doesNotMatch(JSON.stringify(partial), /umami|secret|registry/i)

  const empty = await getClientAnalyticsSummaries([first, second], {
    fetchDashboard: async () => { throw new Error('upstream endpoint and credentials') },
  })
  assert.deepEqual(empty, [])
})
