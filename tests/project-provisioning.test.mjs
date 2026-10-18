import test from 'node:test'
import assert from 'node:assert/strict'

import { database, loadProjectModule, projectId } from './helpers/project-harness.mjs'

const secret = 'provisioning-secret-for-tests'
const registration = {
  name: '  Café Nuevo  ',
  slug: ' Café Nuevo ',
  domain: ' HTTPS://WWW.Example.COM./ ',
}

function responseBoundary(db) {
  return {
    dbReads: [],
    mocks: {
      'next/server': {
        NextResponse: {
          json(body, init = {}) {
            return { body, status: init.status ?? 200, headers: init.headers ?? {} }
          },
        },
      },
      '@/lib/supabase/admin': {
        getSupabaseAdminClient() {
          responseBoundary.lastDbRead = true
          return db
        },
      },
    },
  }
}

function loadRoute(db) {
  responseBoundary.lastDbRead = false
  const boundary = responseBoundary(db)
  return {
    route: loadProjectModule('src/app/api/projects/provision/route.ts', boundary.mocks),
    databaseWasOpened: () => responseBoundary.lastDbRead,
  }
}

function request(payload, authorization = `Bearer ${secret}`) {
  return new Request('https://studio.example.com/api/projects/provision', {
    method: 'POST',
    headers: {
      authorization,
      'content-type': 'application/json',
    },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  })
}

function emptyDatabase(seed = {}) {
  return database({
    clients: [],
    client_projects: [],
    project_capabilities: [],
    project_capability_audit: [],
    ...seed,
  })
}

test('server-to-server route requires the environment secret before parsing or opening Supabase', async t => {
  const previous = process.env.PROJECT_PROVISIONING_SECRET
  t.after(() => {
    if (previous === undefined) delete process.env.PROJECT_PROVISIONING_SECRET
    else process.env.PROJECT_PROVISIONING_SECRET = previous
  })

  const db = emptyDatabase()
  const loaded = loadRoute(db)

  delete process.env.PROJECT_PROVISIONING_SECRET
  const unconfigured = await loaded.route.POST(request('{bad json', 'Bearer anything'))
  assert.equal(unconfigured.status, 503)
  assert.deepEqual(unconfigured.body, { error: 'provisioning_not_configured' })
  assert.equal(loaded.databaseWasOpened(), false)

  process.env.PROJECT_PROVISIONING_SECRET = secret
  for (const authorization of [null, '', 'Basic abc', 'Bearer wrong-secret']) {
    const unauthorized = await loaded.route.POST(request('{bad json', authorization))
    assert.equal(unauthorized.status, 401)
    assert.deepEqual(unauthorized.body, { error: 'unauthorized' })
  }
  assert.equal(loaded.databaseWasOpened(), false)
  assert.doesNotMatch(JSON.stringify(unconfigured.body), new RegExp(secret))
})

test('route rejects malformed JSON and invalid project identities without writing', async t => {
  const previous = process.env.PROJECT_PROVISIONING_SECRET
  process.env.PROJECT_PROVISIONING_SECRET = secret
  t.after(() => {
    if (previous === undefined) delete process.env.PROJECT_PROVISIONING_SECRET
    else process.env.PROJECT_PROVISIONING_SECRET = previous
  })

  for (const payload of [
    '{bad json',
    {},
    { name: '', slug: 'valid', domain: 'example.com' },
    { name: 'Example', slug: '---', domain: 'example.com' },
    { name: 'Example', slug: 'valid', domain: 'localhost' },
    { name: 'Example', slug: 'valid', domain: 'https://user:pass@example.com' },
    { name: 'Example', slug: 'valid', domain: 'https://example.com/path' },
  ]) {
    const db = emptyDatabase()
    const result = await loadRoute(db).route.POST(request(payload))
    assert.equal(result.status, 400, JSON.stringify(payload))
    assert.deepEqual(result.body, { error: 'invalid_payload' })
    assert.equal(db.calls.some(call => call.operation !== 'select'), false)
  }
})

test('registration normalizes identity and creates only locked-down project defaults', async () => {
  const { provisionProject } = await import('../src/lib/projects/provisioning.mjs')
  const db = emptyDatabase()

  const result = await provisionProject(db, registration)

  assert.equal(result.outcome, 'created')
  assert.deepEqual(
    {
      id: result.project.id,
      name: result.project.name,
      slug: result.project.slug,
      domain: result.project.domain,
      status: result.project.status,
      client_id: result.project.client_id,
      client_access_enabled: result.project.client_access_enabled,
    },
    {
      id: projectId,
      name: 'Café Nuevo',
      slug: 'cafe-nuevo',
      domain: 'example.com',
      status: 'draft',
      client_id: null,
      client_access_enabled: false,
    },
  )
  assert.equal(db.calls.some(call => call.table === 'clients'), false)

  const capabilities = db.tables.project_capabilities
  assert.deepEqual(
    capabilities.map(row => row.capability_key).sort(),
    ['analytics', 'blogger', 'bonuses_reports', 'domains', 'hosting', 'invoices', 'products'],
  )
  assert.ok(capabilities.every(row =>
    row.state === 'unavailable' && row.launch_url === null && row.validated_at === null && Object.keys(row.metadata).length === 0))
  assert.equal(
    db.calls.filter(call => call.table === 'project_capabilities' && call.operation === 'insert').length,
    0,
    'automatic provisioning relies on the atomic database trigger for a new project',
  )
  const blogger = capabilities.find(row => row.capability_key === 'blogger')
  assert.deepEqual(
    {
      state: blogger.state,
      launch_url: blogger.launch_url,
      validated_at: blogger.validated_at,
      metadata: blogger.metadata,
    },
    { state: 'unavailable', launch_url: null, validated_at: null, metadata: {} },
  )
})

test('an exact normalized retry returns the same project without changing project or capability rows', async () => {
  const { provisionProject } = await import('../src/lib/projects/provisioning.mjs')
  const existing = {
    id: projectId,
    client_id: '22222222-2222-4222-8222-222222222222',
    slug: 'cafe-nuevo',
    name: 'Nombre administrado',
    domain: 'example.com',
    status: 'active',
    client_access_enabled: true,
    hosting_label: 'Existing hosting',
    hosting_management_url: null,
    analytics_registry_key: 'existing-key',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-02T00:00:00Z',
  }
  const preservedBlogger = {
    id: '44444444-4444-4444-8444-444444444444',
    project_id: projectId,
    capability_key: 'blogger',
    state: 'active',
    launch_url: 'https://example.com/admin/blogger/',
    metadata: { provisioning_confirmed: true, display_label: 'Blog' },
    validated_at: '2026-10-02T00:00:00Z',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-02T00:00:00Z',
  }
  const db = emptyDatabase({ client_projects: [existing], project_capabilities: [preservedBlogger] })

  const first = await provisionProject(db, registration)
  const second = await provisionProject(db, { ...registration, name: 'Intento de sobrescritura' })

  assert.equal(first.outcome, 'existing')
  assert.equal(second.outcome, 'existing')
  assert.equal(first.project.id, projectId)
  assert.equal(second.project.id, projectId)
  assert.equal(db.tables.client_projects.length, 1)
  assert.deepEqual(db.tables.client_projects[0], existing)
  assert.equal(db.tables.project_capabilities.length, 7)
  assert.deepEqual(db.tables.project_capabilities.find(row => row.capability_key === 'blogger'), preservedBlogger)
  assert.equal(db.calls.some(call => call.operation === 'update'), false)
  assert.equal(db.calls.some(call => call.table === 'clients'), false)
})

test('a retry completes missing capability defaults without overwriting existing rows', async () => {
  const { provisionProject } = await import('../src/lib/projects/provisioning.mjs')
  const existing = {
    id: projectId,
    client_id: null,
    slug: 'cafe-nuevo',
    name: 'Café Nuevo',
    domain: 'example.com',
    status: 'draft',
    client_access_enabled: false,
    hosting_label: null,
    hosting_management_url: null,
    analytics_registry_key: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  }
  const configuredDomains = {
    id: '55555555-5555-4555-8555-555555555555',
    project_id: projectId,
    capability_key: 'domains',
    state: 'available',
    launch_url: null,
    metadata: { source: 'manual' },
    validated_at: null,
    created_at: existing.created_at,
    updated_at: existing.updated_at,
  }
  const db = emptyDatabase({ client_projects: [existing], project_capabilities: [configuredDomains] })

  await provisionProject(db, registration)

  assert.equal(db.tables.project_capabilities.length, 7)
  assert.deepEqual(db.tables.project_capabilities.find(row => row.capability_key === 'domains'), configuredDomains)
  assert.ok(db.tables.project_capabilities.filter(row => row.capability_key !== 'domains').every(row => row.state === 'unavailable'))
})

test('domain or slug ownership conflicts are reported without reassignment or access changes', async () => {
  const { ProjectProvisioningError, provisionProject } = await import('../src/lib/projects/provisioning.mjs')
  const assigned = {
    id: projectId,
    client_id: '22222222-2222-4222-8222-222222222222',
    slug: 'owned-project',
    name: 'Owned project',
    domain: 'owned.example.com',
    status: 'active',
    client_access_enabled: true,
    hosting_label: null,
    hosting_management_url: null,
    analytics_registry_key: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  }

  for (const [payload, code] of [
    [{ name: 'Other', slug: 'different-project', domain: 'OWNED.EXAMPLE.COM' }, 'domain_conflict'],
    [{ name: 'Other', slug: 'OWNED-PROJECT', domain: 'different.example.com' }, 'slug_conflict'],
  ]) {
    const db = emptyDatabase({ client_projects: [assigned] })
    await assert.rejects(
      () => provisionProject(db, payload),
      error => error instanceof ProjectProvisioningError && error.code === code && error.status === 409,
    )
    assert.deepEqual(db.tables.client_projects[0], assigned)
    assert.equal(db.calls.some(call => call.operation !== 'select'), false)
    assert.equal(db.calls.some(call => call.table === 'clients'), false)
  }
})

test('authenticated route returns normalized created/existing results and sanitized conflicts', async t => {
  const previous = process.env.PROJECT_PROVISIONING_SECRET
  process.env.PROJECT_PROVISIONING_SECRET = secret
  t.after(() => {
    if (previous === undefined) delete process.env.PROJECT_PROVISIONING_SECRET
    else process.env.PROJECT_PROVISIONING_SECRET = previous
  })

  const db = emptyDatabase()
  const route = loadRoute(db).route
  const created = await route.POST(request(registration))
  const existing = await route.POST(request(registration))
  const conflict = await route.POST(request({ name: 'Other', slug: 'other', domain: 'example.com' }))

  assert.equal(created.status, 201)
  assert.equal(created.body.outcome, 'created')
  assert.deepEqual(created.body.project, { id: projectId, name: 'Café Nuevo', slug: 'cafe-nuevo', domain: 'example.com', status: 'draft' })
  assert.equal(existing.status, 200)
  assert.equal(existing.body.outcome, 'existing')
  assert.equal(existing.body.project.id, projectId)
  assert.equal(conflict.status, 409)
  assert.deepEqual(conflict.body, { error: 'domain_conflict' })
  assert.doesNotMatch(JSON.stringify([created.body, existing.body, conflict.body]), new RegExp(secret))
})
