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
  sites = [configuredSite],
} = {}) {
  const db = database({
    client_projects: [projectRow],
    project_capabilities: [capabilityRow],
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
