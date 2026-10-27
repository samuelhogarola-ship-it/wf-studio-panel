import test from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'

import { client, project, capability, database, loadProjectModule } from './helpers/project-harness.mjs'
import { buildProjectTools } from '../src/lib/projects/tools.mjs'

const siteKey = 'sportmassagefuengirola'
const sportProject = { ...project, slug: siteKey, domain: 'sportmassagefuengirola.com', name: 'Sport Massage' }
const activeCapability = { ...capability, state: 'active', launch_url: null, validated_at: null, metadata: {} }

function setup({ currentProject = sportProject, currentCapability = activeCapability, currentClient = client, email = client.email } = {}) {
  const identity = { userId: 'sport-user', email, role: 'client', client: currentClient }
  const db = database({ clients: [currentClient], client_projects: [currentProject], project_capabilities: [currentCapability] })
  // Keep real pages, registry, authorization, project filtering and editor routing.
  // Replace only the authenticated session and remote Supabase I/O.
  const mocks = {
    '@/lib/auth': { getOptionalIdentity: async () => identity, requireClientAccess: async () => identity },
    '@/lib/support/portal-viewer': { requirePortalViewer: async () => ({ mode: 'client', identity, client: currentClient }) },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => db },
    '@/lib/supabase/admin': { getSupabaseAdminClient: () => db },
  }
  const load = file => loadProjectModule(file, mocks)
  return { db, load }
}

test('Sport panel opens an English one-click temporary launch while direct entry keeps independent credentials', async () => {
  const { db, load } = setup()
  const projectData = load('src/lib/data/projects.ts')
  const accessibleProject = await projectData.getAccessibleClientProject(siteKey)
  const tool = buildProjectTools({
    project: accessibleProject,
    viewer: 'client',
    bloggerRuntime: projectData.getProjectBloggerRuntime(accessibleProject),
  }).find(tool => tool.id === 'blogger')
  assert.equal(tool?.href, '/cliente/proyectos/sportmassagefuengirola/blogger')

  const portalPage = load('src/app/cliente/(protected)/proyectos/[slug]/blogger/page.tsx').default
  const directPage = load('src/app/acceso/blogger/[siteKey]/page.tsx').default
  const panelHtml = renderToStaticMarkup(await portalPage({ params: Promise.resolve({ slug: siteKey }) }))
  assert.match(panelHtml, /Opening Blogger/)
  assert.match(panelHtml, /action="\/api\/tools\/blogger\/sportmassagefuengirola\/launch"/)
  assert.match(panelHtml, /method="post"/)
  assert.doesNotMatch(panelHtml, /admin\.webfuengirola\.com|type="password"/)
  const html = renderToStaticMarkup(await directPage({ params: Promise.resolve({ siteKey }) }))
  assert.match(html, /Access Blogger/)
  assert.match(html, /type="password"/)
  assert.doesNotMatch(html, /src="\/blogger\/index\.html"/)
  await assert.rejects(() => load('src/lib/blogger/legacy-authorize.ts').authorizeSportBlogger(), error => error.status === 403)
  assert.ok(db.calls.every(call => call.operation === 'select'))
})

test('Sport portal, direct entry and editor API deny foreign, revoked or mismatched assignments', async () => {
  for (const options of [
    { currentProject: { ...sportProject, client_id: 'another-client' } },
    { currentProject: { ...sportProject, status: 'archived' } },
    { currentProject: { ...sportProject, client_access_enabled: false } },
    { currentProject: { ...sportProject, domain: 'another.example' } },
    { currentCapability: { ...activeCapability, state: 'unavailable' } },
    { currentCapability: { ...activeCapability, project_id: 'another-project' } },
  ]) {
    const { load } = setup(options)
    const portalPage = load('src/app/cliente/(protected)/proyectos/[slug]/blogger/page.tsx').default
    const directPage = load('src/app/acceso/blogger/[siteKey]/page.tsx').default
    await assert.rejects(() => portalPage({ params: Promise.resolve({ slug: siteKey }) }), { message: '404' })
    const html = renderToStaticMarkup(await directPage({ params: Promise.resolve({ siteKey }) }))
    assert.match(html, /Access Blogger/)
    await assert.rejects(() => load('src/lib/blogger/legacy-authorize.ts').authorizeSportBlogger(), error => error.status === 403)
  }
})

test('Sport panel launch consumes one audience-bound ticket and establishes the scoped session without exposing it', async () => {
  const { db } = setup()
  const created = []
  const consumed = []
  const secret = 'server-derived-session-secret_Aa1!234567890'
  const route = loadProjectModule('src/app/api/tools/blogger/[siteKey]/launch/route.ts', {
    '@/lib/auth': {
      getOptionalIdentity: async () => ({ userId: 'sport-user', email: client.email, role: 'client' }),
      requireClientAccess: async () => ({ userId: 'sport-user', email: client.email, role: 'client', client }),
    },
    '@/lib/data/projects': {
      getAccessibleClientProject: async key => key === siteKey ? sportProject : null,
      getActiveClientCapability: async key => key === siteKey ? activeCapability : null,
    },
    '@/lib/sites/registry.mjs': {
      getSiteByKey: key => key === siteKey ? {
        key: siteKey,
        domain: sportProject.domain,
        blogger: { enabled: true, runtime: 'central-legacy' },
      } : null,
      getBloggerHandoff: () => null,
    },
    '@/lib/supabase/admin': { getSupabaseAdminClient: () => db },
    '@/lib/blogger/direct-access.mjs': {
      DIRECT_BLOGGER_COOKIE: '__Host-wf_blogger',
      createDirectBloggerSession: ({ secret: supplied }) => {
        assert.equal(supplied, secret)
        return 'scoped-session-value'
      },
      loadDirectBloggerSessionConfig: () => ({ sessionSecret: secret, siteKey }),
    },
    '@/lib/tools/launch-tickets.mjs': {
      buildLaunchSecurityHeaders: () => ({ 'Cache-Control': 'private, no-store, max-age=0' }),
      buildLaunchRedirectLocation: () => { throw new Error('external launch must not be used') },
      async createLaunchTicket(_database, input) {
        created.push(input)
        return { code: 'T'.repeat(43), expiresAt: new Date(Date.now() + 60_000).toISOString() }
      },
      async consumeLaunchTicket(_database, input) {
        consumed.push(input)
        return {
          protocol: 'wf-blogger-handoff/v1',
          siteKey,
          audience: 'https://portal.webfuengirola.com',
          projectId: sportProject.id,
          clientId: client.id,
          userId: 'sport-user',
          actorRole: 'client',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }
      },
    },
  })
  const response = await route.POST(new Request('https://portal.webfuengirola.com/api/tools/blogger/sportmassagefuengirola/launch', {
    method: 'POST',
    headers: { origin: 'https://portal.webfuengirola.com' },
  }), { params: Promise.resolve({ siteKey }) })
  assert.equal(response.status, 303)
  assert.equal(response.headers.get('location'), 'https://portal.webfuengirola.com/acceso/blogger/sportmassagefuengirola')
  assert.equal(created.length, 1)
  assert.deepEqual(created[0], {
    siteKey,
    audience: 'https://portal.webfuengirola.com',
    projectId: sportProject.id,
    clientId: client.id,
    userId: 'sport-user',
    actorRole: 'client',
  })
  assert.deepEqual(consumed, [{ code: 'T'.repeat(43), siteKey, audience: 'https://portal.webfuengirola.com' }])
  assert.match(response.headers.get('set-cookie') ?? '', /__Host-wf_blogger=scoped-session-value/)
  assert.match(response.headers.get('set-cookie') ?? '', /HttpOnly/i)
  assert.match(response.headers.get('set-cookie') ?? '', /Secure/i)
  assert.match(response.headers.get('set-cookie') ?? '', /SameSite=strict/i)
  assert.doesNotMatch(
    `${response.headers.get('location')} ${await response.text()}`,
    new RegExp(`${'T'.repeat(43)}|token|admin\\.webfuengirola\\.com`, 'i'),
  )
})

test('Sport panel launch fails closed when the consumed ticket binding differs', async () => {
  const route = loadProjectModule('src/app/api/tools/blogger/[siteKey]/launch/route.ts', {
    '@/lib/auth': {
      getOptionalIdentity: async () => ({ userId: 'sport-user', email: client.email, role: 'client' }),
      requireClientAccess: async () => ({ userId: 'sport-user', email: client.email, role: 'client', client }),
    },
    '@/lib/data/projects': {
      getAccessibleClientProject: async () => sportProject,
      getActiveClientCapability: async () => activeCapability,
    },
    '@/lib/sites/registry.mjs': {
      getSiteByKey: () => ({ key: siteKey, domain: sportProject.domain, blogger: { enabled: true, runtime: 'central-legacy' } }),
      getBloggerHandoff: () => null,
    },
    '@/lib/supabase/admin': { getSupabaseAdminClient: () => ({}) },
    '@/lib/blogger/direct-access.mjs': {
      DIRECT_BLOGGER_COOKIE: '__Host-wf_blogger',
      createDirectBloggerSession: () => 'must-not-be-issued',
      loadDirectBloggerSessionConfig: () => ({ sessionSecret: 'session_Aa1!2345678901234567890', siteKey }),
    },
    '@/lib/tools/launch-tickets.mjs': {
      buildLaunchSecurityHeaders: () => ({ 'Cache-Control': 'private, no-store' }),
      buildLaunchRedirectLocation: () => '',
      createLaunchTicket: async () => ({ code: 'T'.repeat(43) }),
      consumeLaunchTicket: async () => ({
        siteKey,
        audience: 'https://portal.webfuengirola.com',
        projectId: 'another-project',
        clientId: client.id,
        userId: 'sport-user',
        actorRole: 'client',
      }),
    },
  })
  const response = await route.POST(new Request('https://portal.webfuengirola.com/api/tools/blogger/sportmassagefuengirola/launch', {
    method: 'POST', headers: { origin: 'https://portal.webfuengirola.com' },
  }), { params: Promise.resolve({ siteKey }) })
  assert.equal(response.status, 303)
  assert.equal(response.headers.get('location'), 'https://portal.webfuengirola.com/cliente/proyectos/sportmassagefuengirola/blogger?error=launch')
  assert.equal(response.headers.get('set-cookie'), null)
})

test('every central static Blogger runtime uses the same temporary portal handoff without a site-name exception', async () => {
  const staticSiteKey = 'personaltrainerfuengirola'
  const staticProject = { ...sportProject, id: 'project-personal', slug: staticSiteKey, domain: 'personaltrainerfuengirola.com' }
  const created = []
  const route = loadProjectModule('src/app/api/tools/blogger/[siteKey]/launch/route.ts', {
    '@/lib/auth': {
      getOptionalIdentity: async () => ({ userId: 'static-user', email: client.email, role: 'client' }),
      requireClientAccess: async () => ({ userId: 'static-user', email: client.email, role: 'client', client }),
    },
    '@/lib/data/projects': {
      getAccessibleClientProject: async key => key === staticSiteKey ? staticProject : null,
      getActiveClientCapability: async key => key === staticSiteKey ? { ...activeCapability, project_id: staticProject.id } : null,
    },
    '@/lib/sites/registry.mjs': {
      getSiteByKey: () => ({
        key: staticSiteKey,
        domain: staticProject.domain,
        blogger: { enabled: true, runtime: 'central-multisite' },
      }),
      getBloggerHandoff: () => null,
    },
    '@/lib/supabase/admin': { getSupabaseAdminClient: () => ({}) },
    '@/lib/blogger/direct-access.mjs': {
      DIRECT_BLOGGER_COOKIE: '__Host-wf_blogger',
      createDirectBloggerSession: input => {
        assert.equal(input.siteKey, staticSiteKey)
        assert.deepEqual(input.subject, { userId: 'static-user', clientId: client.id, projectId: staticProject.id })
        return 'static-scoped-session'
      },
      loadDirectBloggerSessionConfig: () => ({ sessionSecret: 'session_Aa1!2345678901234567890' }),
    },
    '@/lib/tools/launch-tickets.mjs': {
      buildLaunchSecurityHeaders: () => ({ 'Cache-Control': 'private, no-store' }),
      buildLaunchRedirectLocation: () => '',
      createLaunchTicket: async (_db, input) => {
        created.push(input)
        return { code: 'P'.repeat(43) }
      },
      consumeLaunchTicket: async () => ({
        siteKey: staticSiteKey,
        audience: 'https://portal.webfuengirola.com',
        projectId: staticProject.id,
        clientId: client.id,
        userId: 'static-user',
        actorRole: 'client',
      }),
    },
  })
  const response = await route.POST(new Request(`https://portal.webfuengirola.com/api/tools/blogger/${staticSiteKey}/launch`, {
    method: 'POST', headers: { origin: 'https://portal.webfuengirola.com' },
  }), { params: Promise.resolve({ siteKey: staticSiteKey }) })
  assert.equal(response.status, 303)
  assert.equal(response.headers.get('location'), `https://portal.webfuengirola.com/acceso/blogger/${staticSiteKey}`)
  assert.equal(created.length, 1)
  assert.match(response.headers.get('set-cookie') ?? '', /__Host-wf_blogger=static-scoped-session/)
})

test('central static launch rejects admin, HTTP and alternate-port portal origins before ticket creation', async () => {
  for (const requestUrl of [
    'https://admin.webfuengirola.com/api/tools/blogger/sportmassagefuengirola/launch',
    'http://portal.webfuengirola.com/api/tools/blogger/sportmassagefuengirola/launch',
    'https://portal.webfuengirola.com:8443/api/tools/blogger/sportmassagefuengirola/launch',
  ]) {
    let created = 0
    const origin = new URL(requestUrl).origin
    const route = loadProjectModule('src/app/api/tools/blogger/[siteKey]/launch/route.ts', {
      '@/lib/auth': {
        getOptionalIdentity: async () => ({ userId: 'sport-user', email: client.email, role: 'client' }),
        requireClientAccess: async () => ({ userId: 'sport-user', email: client.email, role: 'client', client }),
      },
      '@/lib/data/projects': {
        getAccessibleClientProject: async () => sportProject,
        getActiveClientCapability: async () => activeCapability,
      },
      '@/lib/sites/registry.mjs': {
        getSiteByKey: () => ({ key: siteKey, domain: sportProject.domain, blogger: { enabled: true, runtime: 'central-legacy' } }),
        getBloggerHandoff: () => null,
      },
      '@/lib/tools/launch-tickets.mjs': {
        buildLaunchSecurityHeaders: () => ({}), buildLaunchRedirectLocation: () => '',
        createLaunchTicket: async () => { created += 1 }, consumeLaunchTicket: async () => null,
      },
    })
    const response = await route.POST(new Request(requestUrl, { method: 'POST', headers: { origin } }), {
      params: Promise.resolve({ siteKey }),
    })
    assert.equal(response.status, 404, requestUrl)
    assert.equal(created, 0, requestUrl)
  }
})

test('direct Blogger-only session authorizes only the existing Sport legacy publisher', async () => {
  let panelAuthorizationCalls = 0
  const authorization = await loadProjectModule('src/lib/blogger/legacy-authorize.ts', {
    '@/lib/blogger/direct-access-server': {
      getDirectBloggerSession: async () => ({ siteKey, source: 'direct', subject: null, expiresAt: Date.now() + 60_000 }),
    },
    '@/lib/blogger/authorize': {
      authorizeBloggerSite: async () => { panelAuthorizationCalls += 1; throw new Error('panel auth must not be required') },
    },
    '@/lib/blogger/sites.mjs': {
      getBloggerSite: key => ({ site: { key, domain: 'sportmassagefuengirola.com', name: 'Sport Massage' }, root: '/data/blogger/sportmassagefuengirola' }),
    },
  }).authorizeSportBlogger()

  assert.equal(authorization.site.key, siteKey)
  assert.equal(authorization.identity.role, 'blogger')
  assert.equal(panelAuthorizationCalls, 0)
})
