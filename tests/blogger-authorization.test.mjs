import test from 'node:test'
import assert from 'node:assert/strict'

import { loadProjectModule, database, client, project, capability } from './helpers/project-harness.mjs'

const siteKey = 'samuelcoachdealeman'
const identity = { userId: 'client-user', email: client.email, role: 'client' }
const site = { root: '/tmp/site', site: { key: siteKey, domain: project.domain, blogger: { enabled: true } } }

function authorize(seed, currentIdentity = identity) {
  const db = database(seed)
  const module = loadProjectModule('src/lib/blogger/authorize.ts', {
    '@/lib/auth': { getOptionalIdentity: async () => currentIdentity },
    '@/lib/blogger/sites.mjs': { getBloggerSite: () => site },
    '@/lib/supabase/admin': { getSupabaseAdminClient: () => db },
  })
  return module.authorizeBloggerSite(siteKey)
}

const activeSeed = {
  clients: [client],
  client_projects: [{ ...project, slug: siteKey }],
  project_capabilities: [{ ...capability, state: 'active' }],
}

test('client Blogger authorization requires active client, current project ownership, access and active capability', async () => {
  assert.equal((await authorize(activeSeed)).site.key, siteKey)
  for (const seed of [
    { ...activeSeed, clients: [{ ...client, status: 'inactive' }] },
    { ...activeSeed, client_projects: [{ ...project, slug: siteKey, client_id: 'other' }] },
    { ...activeSeed, client_projects: [{ ...project, slug: siteKey, status: 'archived' }] },
    { ...activeSeed, client_projects: [{ ...project, slug: siteKey, client_access_enabled: false }] },
    { ...activeSeed, project_capabilities: [{ ...capability, state: 'available' }] },
  ]) {
    await assert.rejects(() => authorize(seed), error => error?.status === 403)
  }
})

test('stale legacy Blogger membership cannot grant access without an assigned project', async () => {
  await assert.rejects(() => authorize({ ...activeSeed, client_projects: [], blogger_site_memberships: [{ user_id: identity.userId, site_key: siteKey }] }), error => error?.status === 403)
})

test('Blogger authorization binds the requested registry site to the exact project domain', async () => {
  await assert.rejects(
    () => authorize({
      ...activeSeed,
      client_projects: [{ ...project, slug: siteKey, domain: 'another-site.example' }],
    }),
    error => error?.status === 403,
  )
})

test('administrators retain Blogger access without a client assignment but still require the exact active capability', async () => {
  const admin = { ...identity, role: 'admin' }
  const unassignedProject = { ...project, slug: siteKey, client_id: null }

  assert.equal((await authorize({
    client_projects: [unassignedProject],
    project_capabilities: [{ ...capability, state: 'active' }],
  }, admin)).site.key, siteKey)
  await assert.rejects(
    () => authorize({ client_projects: [unassignedProject], project_capabilities: [] }, admin),
    error => error?.status === 403,
  )
})

test('Blogger authorization never trusts a caller-supplied identity over the authenticated session', async () => {
  const db = database({
    client_projects: [{ ...project, slug: siteKey, client_id: null }],
    project_capabilities: [{ ...capability, state: 'active' }],
  })
  const module = loadProjectModule('src/lib/blogger/authorize.ts', {
    '@/lib/auth': { getOptionalIdentity: async () => null },
    '@/lib/blogger/sites.mjs': { getBloggerSite: () => site },
    '@/lib/supabase/admin': { getSupabaseAdminClient: () => db },
  })

  await assert.rejects(
    () => module.authorizeBloggerSite(siteKey, { ...identity, role: 'admin' }),
    error => error?.status === 401,
  )
  assert.deepEqual(db.calls, [])
})
