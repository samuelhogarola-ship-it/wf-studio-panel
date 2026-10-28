import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { getBloggerEditorTarget } from '../src/lib/blogger/editor.mjs'
import {
  loadProjectModule,
  database,
  capability,
  project,
} from './helpers/project-harness.mjs'

const routePath = 'src/app/acceso/blogger/[siteKey]/page.tsx'
const shellPath = 'src/components/blogger/direct-blogger-shell.tsx'

const sites = {
  sportmassagefuengirola: {
    key: 'sportmassagefuengirola',
    name: 'Sport Massage Fuengirola',
    domain: 'sportmassagefuengirola.com',
    blogger: { enabled: true, runtime: 'central-legacy', url: 'https://sportmassagefuengirola.com/admin/blogger/' },
  },
  agama: {
    key: 'agama',
    name: 'aGama',
    domain: 'agama.com.mx',
    blogger: { enabled: true, runtime: 'central-multisite', url: 'https://admin.webfuengirola.com/paneladmin/blogger/agama' },
  },
}

const identities = {
  sofia: { userId: 'sofia-user', email: 'sofia@sport.example', role: 'client' },
  agama: { userId: 'agama-user', email: 'editor@agama.example', role: 'client' },
  admin: { userId: 'admin-user', email: 'samuel@webfuengirola.com', role: 'admin' },
}

function projectFor(siteKey, clientId) {
  return {
    ...project,
    id: `project-${siteKey}`,
    client_id: clientId,
    slug: siteKey,
    name: sites[siteKey].name,
    domain: sites[siteKey].domain,
  }
}

function capabilityFor(siteKey) {
  return {
    ...capability,
    id: `capability-${siteKey}`,
    project_id: `project-${siteKey}`,
    state: 'active',
    launch_url: sites[siteKey].blogger.url,
    validated_at: project.created_at,
    metadata: { provisioning_confirmed: true },
  }
}

function setup({ identity = null, directSession = null, authorizedSites = [] } = {}) {
  const clients = authorizedSites.map((siteKey, index) => ({
    id: `client-${siteKey}`,
    name: siteKey === 'sportmassagefuengirola' ? 'Sofia' : 'aGama editor',
    email: siteKey === 'sportmassagefuengirola' ? identities.sofia.email : identities.agama.email,
    status: 'active',
    project: 'wf-studio',
    portal_mode: 'dynamic',
    index,
  }))
  const db = database({
    clients,
    client_projects: authorizedSites.map(siteKey => projectFor(siteKey, `client-${siteKey}`)),
    project_capabilities: authorizedSites.map(capabilityFor),
  })
  const mocks = {
    '@/lib/auth': { getOptionalIdentity: async () => identity },
    '@/lib/blogger/direct-access-server': { getDirectBloggerSession: async () => directSession },
    '@/lib/blogger/sites.mjs': {
      getBloggerSite(siteKey) {
        const site = sites[siteKey]
        if (!site) throw Object.assign(new Error('unknown site'), { status: 404 })
        return { site, root: `/data/blogger/${siteKey}` }
      },
    },
    '@/lib/blogger/editor.mjs': { getBloggerEditorTarget },
    '@/lib/supabase/admin': { getSupabaseAdminClient: () => db },
  }
  const Page = loadProjectModule(routePath, mocks).default
  return { db, Page }
}

test('Sport Massage direct route renders the independent English login instead of the panel login', async () => {
  const { Page, db } = setup()
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ siteKey: 'sportmassagefuengirola' }) }))
  assert.match(html, /Access WF-Blogger/)
  assert.match(html, /sportmassagefuengirola@gmail\.com/)
  assert.match(html, /type="password"/)
  assert.match(html, />Show</)
  assert.doesNotMatch(html, /Forgot|Reset|Change password|admin\.webfuengirola\.com/)
  assert.deepEqual(db.calls, [])
})

test('expired temporary access shows a generic retry message without exposing ticket details', async () => {
  const { Page } = setup()
  const html = renderToStaticMarkup(await Page({
    params: Promise.resolve({ siteKey: 'sportmassagefuengirola' }),
    searchParams: Promise.resolve({ error: 'handoff' }),
  }))
  assert.match(html, /temporary access link/i)
  assert.match(html, /sign in with your WF-Blogger password/i)
  assert.doesNotMatch(html, /ticket|code=|token/i)
})

test('direct credential session opens the existing editor and exposes Sign out', async () => {
  const { Page } = setup({ directSession: { siteKey: 'sportmassagefuengirola', source: 'direct', subject: null } })
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ siteKey: 'sportmassagefuengirola' }) }))
  assert.match(html, /src="\/blogger\/index\.html"/)
  assert.match(html, />Sign out</)
  assert.doesNotMatch(html, /admin\.webfuengirola\.com|paneladmin/)
})

test('an ordinary Sofia panel session still requires the independent Blogger credential', async () => {
  const { Page } = setup({ identity: identities.sofia, authorizedSites: ['sportmassagefuengirola'] })
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ siteKey: 'sportmassagefuengirola' }) }))

  assert.match(html, /Access WF-Blogger/)
  assert.match(html, /type="password"/)
  assert.doesNotMatch(html, /src="\/blogger\/index\.html"|paneladmin/)
})

test('aGama panel-ticket session receives only the exact aGama editor', async () => {
  const { Page } = setup({
    identity: identities.agama,
    authorizedSites: ['agama'],
    directSession: {
      siteKey: 'agama',
      source: 'panel',
      subject: { userId: identities.agama.userId, clientId: 'client-agama', projectId: 'project-agama' },
    },
  })
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ siteKey: 'agama' }) }))

  assert.match(html, /aGama/)
  assert.match(html, /src="\/blogger\/editor\/index\.html\?siteKey=agama"/)
  assert.doesNotMatch(html, /sportmassagefuengirola|\/blogger\/index\.html"/)
})

test('a client cannot use its ordinary session to guess the Sport editor', async () => {
  const { Page } = setup({ identity: identities.agama, authorizedSites: ['agama'] })
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ siteKey: 'sportmassagefuengirola' }) }))
  assert.match(html, /Access WF-Blogger/)
  assert.doesNotMatch(html, /src="\/blogger\/index\.html"/)
})

test('administrator direct access succeeds only for the exact active Blogger project', async () => {
  const { Page } = setup({ identity: identities.admin, authorizedSites: ['agama'] })
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ siteKey: 'agama' }) }))

  assert.match(html, /src="\/blogger\/editor\/index\.html\?siteKey=agama"/)
  assert.match(html, /href="\/paneladmin\/inicio"[^>]*>Inicio</)
  assert.doesNotMatch(html, /Clientes|Configuración|Otros paneles/)
})

test('direct Blogger shell contains only site identity, Inicio and the existing editor target', () => {
  const DirectBloggerShell = loadProjectModule(shellPath).DirectBloggerShell
  const html = renderToStaticMarkup(React.createElement(DirectBloggerShell, {
    site: sites.agama,
    homeHref: '/cliente',
    target: getBloggerEditorTarget(sites.agama),
  }))

  assert.match(html, /aGama/)
  assert.match(html, /agama\.com\.mx/)
  assert.deepEqual([...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]), ['/cliente'])
  assert.deepEqual([...html.matchAll(/src="([^"]+)"/g)].map(match => match[1].replace(/&amp;/g, '&')), ['/blogger/editor/index.html?siteKey=agama'])
  assert.doesNotMatch(html, /AdminShell|Proyectos|Clientes|Configuración|Sport Massage/)
})
