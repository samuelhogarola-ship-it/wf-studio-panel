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

test('Sport portal button and direct entry reuse the current Supabase session and the same central editor', async () => {
  const { db, load } = setup()
  const accessibleProject = await load('src/lib/data/projects.ts').getAccessibleClientProject(siteKey)
  const tool = buildProjectTools({ project: accessibleProject, viewer: 'client' }).find(tool => tool.id === 'blogger')
  assert.equal(tool?.href, '/cliente/proyectos/sportmassagefuengirola/blogger')

  const portalPage = load('src/app/cliente/(protected)/proyectos/[slug]/blogger/page.tsx').default
  const directPage = load('src/app/acceso/blogger/[siteKey]/page.tsx').default
  for (const element of [
    await portalPage({ params: Promise.resolve({ slug: siteKey }) }),
    await directPage({ params: Promise.resolve({ siteKey }) }),
  ]) {
    const html = renderToStaticMarkup(element)
    assert.match(html, /src="\/blogger\/index\.html"/)
    assert.doesNotMatch(html, /<form|\/launch|\/exchange|\/consume|https:\/\/sportmassagefuengirola\.com\/admin/)
  }

  const authorization = await load('src/lib/blogger/legacy-authorize.ts').authorizeSportBlogger()
  assert.equal(authorization.identity.userId, 'sport-user')
  assert.equal(authorization.project.client_id, client.id)
  assert.equal(authorization.site.key, siteKey)
  assert.ok(db.calls.every(call => call.operation === 'select'), 'entry must not create tickets or another authentication session')
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
    await assert.rejects(() => directPage({ params: Promise.resolve({ siteKey }) }), { message: '404' })
    await assert.rejects(() => load('src/lib/blogger/legacy-authorize.ts').authorizeSportBlogger(), error => error.status === 403)
  }
})

test('Sport cannot invoke the discarded external launch operation', async () => {
  const { load, db } = setup()
  const route = load('src/app/api/tools/blogger/[siteKey]/launch/route.ts')
  const response = await route.POST(new Request('https://portal.webfuengirola.com/api/tools/blogger/sportmassagefuengirola/launch', {
    method: 'POST',
    headers: { origin: 'https://portal.webfuengirola.com' },
  }), { params: Promise.resolve({ siteKey }) })
  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: 'tool_unavailable' })
  assert.deepEqual(db.calls, [])
})
