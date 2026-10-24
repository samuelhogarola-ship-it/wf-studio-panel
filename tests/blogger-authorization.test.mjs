import test from 'node:test'
import assert from 'node:assert/strict'

import { loadProjectModule, database, client, project, capability } from './helpers/project-harness.mjs'

const siteKey = 'samuelcoachdealeman'
const identity = { userId: 'client-user', email: client.email, role: 'client' }
const registrySite = {
  key: siteKey,
  domain: project.domain,
  blogger: {
    enabled: true,
    runtime: 'central-multisite',
    url: `https://admin.webfuengirola.com/paneladmin/blogger/${siteKey}`,
  },
}
const site = { root: '/tmp/site', site: registrySite }
const validCapability = {
  ...capability,
  state: 'active',
  launch_url: registrySite.blogger.url,
  validated_at: project.created_at,
  metadata: { provisioning_confirmed: true },
}

function authorize(seed, currentIdentity = identity, options = {}) {
  const db = database(seed)
  const configuredSite = options.site ?? registrySite
  const module = loadProjectModule('src/lib/blogger/authorize.ts', {
    '@/lib/auth': { getOptionalIdentity: async () => currentIdentity },
    '@/lib/blogger/sites.mjs': { getBloggerSite: () => ({ ...site, site: configuredSite }) },
    '@/lib/blogger/editor.mjs': { getBloggerEditorTarget: () => options.editor === undefined ? { kind: 'iframe', href: `/blogger/editor/index.html?siteKey=${siteKey}` } : options.editor },
    '@/lib/supabase/admin': { getSupabaseAdminClient: () => db },
  })
  return { db, result: module.authorizeBloggerSite(siteKey) }
}

const activeSeed = {
  clients: [client],
  client_projects: [{ ...project, slug: siteKey }],
  project_capabilities: [validCapability],
}

test('client Blogger authorization requires active client, current project ownership, access and active capability', async () => {
  assert.equal((await authorize(activeSeed).result).site.key, siteKey)
  for (const seed of [
    { ...activeSeed, clients: [{ ...client, status: 'inactive' }] },
    { ...activeSeed, client_projects: [{ ...project, slug: siteKey, client_id: 'other' }] },
    { ...activeSeed, client_projects: [{ ...project, slug: siteKey, status: 'archived' }] },
    { ...activeSeed, client_projects: [{ ...project, slug: siteKey, client_access_enabled: false }] },
    { ...activeSeed, project_capabilities: [{ ...capability, state: 'available' }] },
  ]) {
    await assert.rejects(() => authorize(seed).result, error => error?.status === 403)
  }
})

test('stale legacy Blogger membership cannot grant access without an assigned project', async () => {
  await assert.rejects(() => authorize({ ...activeSeed, client_projects: [], blogger_site_memberships: [{ user_id: identity.userId, site_key: siteKey }] }).result, error => error?.status === 403)
})

test('Blogger authorization binds the requested registry site to the exact project domain', async () => {
  await assert.rejects(
    () => authorize({
      ...activeSeed,
      client_projects: [{ ...project, slug: siteKey, domain: 'another-site.example' }],
    }).result,
    error => error?.status === 403,
  )
})

test('administrators retain Blogger access without a client assignment but still require the exact active capability', async () => {
  const admin = { ...identity, role: 'admin' }
  const unassignedProject = { ...project, slug: siteKey, client_id: null }

  assert.equal((await authorize({
    client_projects: [unassignedProject],
    project_capabilities: [validCapability],
  }, admin).result).site.key, siteKey)
  await assert.rejects(
    () => authorize({ client_projects: [unassignedProject], project_capabilities: [] }, admin).result,
    error => error?.status === 403,
  )
})

test('direct Blogger authorization reads and validates the complete capability contract', async () => {
  const { db, result } = authorize(activeSeed)
  assert.equal((await result).site.key, siteKey)
  const capabilityRead = db.calls.find(call => call.table === 'project_capabilities')
  assert.equal(capabilityRead.columns, 'id, capability_key, state, launch_url, validated_at, metadata')
})

test('external Blogger authorization fails closed for stale or unprovisioned capabilities for clients and admins', async () => {
  const externalSite = {
    ...registrySite,
    blogger: {
      enabled: true,
      runtime: 'external',
      url: `https://${project.domain}/admin/blogger/`,
    },
  }
  const externalCapability = { ...validCapability, launch_url: externalSite.blogger.url }
  const staleCapabilities = [
    { ...externalCapability, launch_url: null },
    { ...externalCapability, launch_url: 'https://evil.example/blogger' },
    { ...externalCapability, validated_at: null },
    { ...externalCapability, metadata: {} },
  ]
  const admin = { ...identity, role: 'admin' }
  for (const currentIdentity of [identity, admin]) {
    for (const staleCapability of staleCapabilities) {
      const seed = {
        ...activeSeed,
        client_projects: [{ ...project, slug: siteKey, client_id: currentIdentity.role === 'admin' ? null : project.client_id }],
        project_capabilities: [staleCapability],
      }
      await assert.rejects(
        () => authorize(seed, currentIdentity, { site: externalSite, editor: { kind: 'external', href: externalSite.blogger.url } }).result,
        error => error?.status === 403,
      )
    }
  }
})

test('central legacy Blogger authorization needs active assignment and capability but no external handoff metadata', async () => {
  const centralSite = {
    key: siteKey,
    domain: project.domain,
    blogger: {
      enabled: true,
      runtime: 'central-legacy',
      url: `https://admin.webfuengirola.com/acceso/blogger/${siteKey}`,
    },
  }
  const centralCapability = {
    ...capability,
    state: 'active',
    launch_url: null,
    validated_at: null,
    metadata: null,
  }

  assert.equal((await authorize({
    ...activeSeed,
    project_capabilities: [centralCapability],
  }, identity, { site: centralSite, editor: { kind: 'iframe', href: '/blogger/index.html' } }).result).site.key, siteKey)
})

test('direct Blogger authorization fails closed for stale registry, domain, runtime or editor', async () => {
  const cases = [
    { site: { ...registrySite, domain: 'foreign.example' } },
    { site: { ...registrySite, blogger: { ...registrySite.blogger, enabled: false } } },
    { editor: null },
  ]
  for (const options of cases) {
    await assert.rejects(() => authorize(activeSeed, identity, options).result, error => error?.status === 403)
  }
})

test('Blogger authorization never trusts a caller-supplied identity over the authenticated session', async () => {
  const db = database({
    client_projects: [{ ...project, slug: siteKey, client_id: null }],
    project_capabilities: [validCapability],
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
