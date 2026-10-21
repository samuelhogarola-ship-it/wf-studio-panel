import test from 'node:test'
import assert from 'node:assert/strict'

import {
  loadProjectModule,
  database,
  project,
  capability,
  client,
  otherClientId,
} from './helpers/project-harness.mjs'

const resolverPath = 'src/lib/analytics/project-access.ts'
const configuredProject = {
  ...project,
  slug: 'my-site',
  domain: 'webfuengirola.com',
  analytics_registry_key: 'webfuengirola',
}
const activeAnalytics = {
  ...capability,
  capability_key: 'analytics',
  state: 'active',
  project_id: configuredProject.id,
}
const configuredSite = {
  key: 'webfuengirola',
  domain: 'webfuengirola.com',
  websiteId: 'configured-in-runtime',
  source: 'personal',
}

function setup({
  projectRow = configuredProject,
  capabilityRow = activeAnalytics,
  projectRows,
  capabilityRows,
  sites = [configuredSite],
} = {}) {
  const db = database({
    client_projects: projectRows ?? [projectRow],
    project_capabilities: capabilityRows ?? [capabilityRow],
  })
  const accessEvents = []
  const analytics = loadProjectModule(resolverPath, {
    '@/lib/auth': {
      requireAdmin: async () => {
        accessEvents.push('admin')
        return { userId: 'admin-id', email: 'admin@example.com', role: 'admin' }
      },
      requireClientAccess: async () => {
        accessEvents.push('client')
        return {
          userId: 'session-user',
          email: client.email,
          role: 'client',
          client: { ...client, portal_mode: 'dynamic' },
        }
      },
    },
    '@/lib/supabase/server': {
      createSupabaseServerClient: async () => db,
    },
    '@/lib/analytics/umami-core.mjs': {
      getConfiguredUmamiSites: () => sites,
      getUmamiConnections: () => ({
        personal: { baseUrl: 'https://stats.example.test', password: 'runtime-secret' },
        agama: { baseUrl: 'https://agama-stats.example.test', password: 'runtime-secret' },
      }),
    },
  })
  return { analytics, accessEvents, db }
}

const unavailable = /Proyecto de estadísticas desconocido/

test('administrator resolution returns the exact authorized project analytics target', async () => {
  const s = setup()

  assert.deepEqual(await s.analytics.resolveAdminAnalyticsTarget(configuredProject.id), {
    projectId: configuredProject.id,
    projectSlug: 'my-site',
    registryKey: 'webfuengirola',
  })
  assert.deepEqual(s.accessEvents, ['admin'])
})

test('assigned client resolution returns the exact authorized project analytics target', async () => {
  const s = setup()

  assert.deepEqual(await s.analytics.resolveClientAnalyticsTarget('my-site'), {
    projectId: configuredProject.id,
    projectSlug: 'my-site',
    registryKey: 'webfuengirola',
  })
  assert.deepEqual(s.accessEvents, ['client'])
})

test('disabled analytics capability cannot resolve a target', async () => {
  const s = setup({ capabilityRow: { ...activeAnalytics, state: 'available' } })

  await assert.rejects(() => s.analytics.resolveClientAnalyticsTarget('my-site'), unavailable)
})

test('inactive project cannot resolve an analytics target', async () => {
  const s = setup({ projectRow: { ...configuredProject, status: 'archived' } })

  await assert.rejects(() => s.analytics.resolveAdminAnalyticsTarget(configuredProject.id), unavailable)
  await assert.rejects(() => s.analytics.resolveClientAnalyticsTarget('my-site'), unavailable)
})

test('disabled client access cannot resolve an analytics target', async () => {
  const s = setup({ projectRow: { ...configuredProject, client_access_enabled: false } })

  await assert.rejects(() => s.analytics.resolveClientAnalyticsTarget('my-site'), unavailable)
})

test('missing analytics registry key cannot resolve a target', async () => {
  const s = setup({ projectRow: { ...configuredProject, analytics_registry_key: null } })

  await assert.rejects(() => s.analytics.resolveAdminAnalyticsTarget(configuredProject.id), unavailable)
})

test('invalid analytics registry configuration cannot resolve a target', async () => {
  const s = setup({ sites: [{ ...configuredSite, domain: 'another-project.example' }] })

  await assert.rejects(() => s.analytics.resolveAdminAnalyticsTarget(configuredProject.id), unavailable)
})

test('client cannot resolve another client project by guessing its slug', async () => {
  const s = setup({ projectRow: { ...configuredProject, client_id: otherClientId } })

  await assert.rejects(() => s.analytics.resolveClientAnalyticsTarget('my-site'), unavailable)
})

test('all existing administrator panels resolve canonical registry keys to project ids', async () => {
  const callers = [
    { id: '00000001-1111-4111-8111-111111111111', key: 'webfuengirola', domain: 'webfuengirola.com' },
    { id: '00000002-1111-4111-8111-111111111111', key: 'vivirenfuengirola', domain: 'vivirenfuengirola.com' },
    { id: '00000003-1111-4111-8111-111111111111', key: 'conocef', domain: 'conocefuengirola.com' },
    { id: '00000004-1111-4111-8111-111111111111', key: 'samuelcoachdealeman', domain: 'samuelcoachdealeman.com' },
    { id: '00000005-1111-4111-8111-111111111111', key: 'vokabellab', domain: 'vokabellab.com' },
    { id: '00000006-1111-4111-8111-111111111111', key: 'superentrenador', domain: 'superentrenador.com' },
    { id: '00000007-1111-4111-8111-111111111111', key: 'todoplastico', domain: 'todo-plastico.com', source: 'agama' },
  ]
  const projectRows = callers.map(({ id, key, domain }) => ({
    ...configuredProject,
    id,
    slug: key,
    domain,
    analytics_registry_key: key,
  }))
  const capabilityRows = callers.map(({ id }, index) => ({
    ...activeAnalytics,
    id: `analytics-${index + 1}`,
    project_id: id,
  }))
  const sites = callers.map(({ key, domain, source = 'personal' }) => ({
    key,
    domain,
    source,
    websiteId: `${key}-runtime-id`,
  }))
  const s = setup({ projectRows, capabilityRows, sites })

  for (const { id, key } of callers) {
    assert.deepEqual(await s.analytics.resolveAdminAnalyticsTargetForRegistryKey(key), {
      projectId: id,
      projectSlug: key,
      registryKey: key,
    })
  }
})
