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
  }
}

function setup({ identity = null, authorizedSites = [] } = {}) {
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

test('direct Blogger route explicitly sends an unauthenticated request to client login with the exact destination', async () => {
  const { Page, db } = setup()

  await assert.rejects(
    () => Page({ params: Promise.resolve({ siteKey: 'sportmassagefuengirola' }) }),
    { message: 'redirect:/cliente?redirectedFrom=/acceso/blogger/sportmassagefuengirola' },
  )
  assert.deepEqual(db.calls, [])
})

test('authorized Sofia resolves the Sport Massage editor in the client-safe shell', async () => {
  const { Page } = setup({ identity: identities.sofia, authorizedSites: ['sportmassagefuengirola'] })
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ siteKey: 'sportmassagefuengirola' }) }))

  assert.match(html, /Sport Massage Fuengirola/)
  assert.match(html, /src="\/blogger\/index\.html"/)
  assert.match(html, /href="\/cliente"[^>]*>Inicio</)
  assert.doesNotMatch(html, /paneladmin|Proyectos|Clientes|Configuración/)
})

test('authorized aGama client receives only the exact aGama editor', async () => {
  const { Page } = setup({ identity: identities.agama, authorizedSites: ['agama'] })
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ siteKey: 'agama' }) }))

  assert.match(html, /aGama/)
  assert.match(html, /src="\/blogger\/editor\/index\.html\?siteKey=agama"/)
  assert.doesNotMatch(html, /sportmassagefuengirola|\/blogger\/index\.html"/)
})

test('a client cannot guess another site direct route', async () => {
  const { Page } = setup({ identity: identities.agama, authorizedSites: ['agama'] })

  await assert.rejects(
    () => Page({ params: Promise.resolve({ siteKey: 'sportmassagefuengirola' }) }),
    { message: '404' },
  )
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
