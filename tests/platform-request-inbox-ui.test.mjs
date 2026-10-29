import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { loadProjectModule } from './helpers/project-harness.mjs'

const counts = {
  'vivir-fuengirola': 2,
  'vivir-fuengirola-negocios': 3,
  'conoce-fuengirola': 4,
}

const request = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  platform: 'vivir-fuengirola',
  request_type: 'client',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+34 600 000 000',
  company: 'Analytical Engines',
  profile_data: { sector: 'Tecnología', note: '<img src=x onerror=alert(1)>' },
  message: 'Quiero publicar mi ficha.',
  source_url: 'https://vivirenfuengirola.com/alta',
  status: 'pending',
  converted_client_id: null,
  reviewed_at: null,
  rejection_reason: null,
  created_at: '2026-10-29T10:00:00Z',
}

const actionMocks = {
  '@/lib/actions/platform-requests': {
    approvePlatformRequestAction: async () => ({ success: 'ok' }),
    rejectPlatformRequestAction: async () => ({ success: 'ok' }),
  },
}

test('platform navigation is constant and shows isolated pending counters', () => {
  const { PlatformSectionNav } = loadProjectModule('src/components/admin/platform-section-nav.tsx')
  const vivir = renderToStaticMarkup(React.createElement(PlatformSectionNav, {
    section: 'vivir', currentPath: '/paneladmin/vivir-en-fuengirola/clientes', counts,
  }))
  for (const label of ['Resumen', 'Clientes', 'Suscripciones', 'Negocios', 'Solicitudes']) assert.match(vivir, new RegExp(label))
  assert.match(vivir, /href="\/paneladmin\/vivir-en-fuengirola\/solicitudes\?scope=clients"/)
  assert.match(vivir, />5<\/span>/)
  assert.match(vivir, /aria-current="page"[^>]*>Clientes/)

  const conoce = renderToStaticMarkup(React.createElement(PlatformSectionNav, {
    section: 'conoce', currentPath: '/paneladmin/conoce-fuengirola/solicitudes', counts,
  }))
  assert.doesNotMatch(conoce, />Negocios</)
  assert.match(conoce, /href="\/paneladmin\/conoce-fuengirola\/solicitudes"/)
  assert.match(conoce, />4<\/span>/)
})

test('Vivir inbox list exposes scope tabs, canonical filters and request metadata', () => {
  const { PlatformRequestInbox } = loadProjectModule('src/components/admin/platform-request-inbox.tsx', actionMocks)
  const html = renderToStaticMarkup(React.createElement(PlatformRequestInbox, {
    scope: 'vivir-clients',
    data: { requests: [request], selectedRequest: null },
    query: 'Ada',
    status: 'pending',
  }))
  assert.match(html, /href="\/paneladmin\/vivir-en-fuengirola\/solicitudes\?scope=clients"[^>]*aria-current="page"/)
  assert.match(html, /href="\/paneladmin\/vivir-en-fuengirola\/solicitudes\?scope=businesses"/)
  assert.match(html, /name="q" value="Ada"/)
  assert.match(html, /name="status"/)
  assert.match(html, /Ada Lovelace/)
  assert.match(html, /Cliente/)
  assert.match(html, /29\/10\/2026/)
  assert.match(html, new RegExp(`request=${request.id}`))
})

test('request detail replaces the table, escapes profile data and exposes review actions', () => {
  const { PlatformRequestInbox } = loadProjectModule('src/components/admin/platform-request-inbox.tsx', actionMocks)
  const approved = { ...request, status: 'approved', converted_client_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }
  const html = renderToStaticMarkup(React.createElement(PlatformRequestInbox, {
    scope: 'vivir-clients',
    data: { requests: [approved], selectedRequest: approved },
    query: '',
    status: 'approved',
  }))
  assert.match(html, /Volver a solicitudes/)
  assert.doesNotMatch(html, /<table/)
  assert.match(html, /Tecnología/)
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/)
  assert.doesNotMatch(html, /<img src=x/)
  assert.match(html, /href="\/paneladmin\/clientes\/dddddddd-dddd-4ddd-8ddd-dddddddddddd"/)

  const pendingHtml = renderToStaticMarkup(React.createElement(PlatformRequestInbox, {
    scope: 'vivir-clients', data: { requests: [request], selectedRequest: request }, query: '', status: 'pending',
  }))
  assert.match(pendingHtml, /name="request_id" value="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"/)
  assert.match(pendingHtml, />Aprobar</)
  assert.match(pendingHtml, />Rechazar</)
  assert.match(pendingHtml, /name="reason"/)
})

test('Vivir and Conoce pages request only their allowed platform namespace', async () => {
  const calls = []
  const mocks = {
    ...actionMocks,
    '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
    '@/lib/platform-requests/admin': {
      getPendingPlatformRequestCounts: async () => counts,
      getPlatformRequestInbox: async (input) => { calls.push(input); return { requests: [], selectedRequest: null } },
    },
  }
  const VivirPage = loadProjectModule('src/app/paneladmin/(protected)/vivir-en-fuengirola/solicitudes/page.tsx', mocks).default
  const ConocePage = loadProjectModule('src/app/paneladmin/(protected)/conoce-fuengirola/solicitudes/page.tsx', mocks).default

  renderToStaticMarkup(await VivirPage({ searchParams: Promise.resolve({ scope: 'businesses', status: 'pending' }) }))
  renderToStaticMarkup(await ConocePage({ searchParams: Promise.resolve({ scope: 'businesses', status: 'pending' }) }))
  assert.deepEqual(calls[0].platforms, ['vivir-fuengirola-negocios'])
  assert.deepEqual(calls[1].platforms, ['conoce-fuengirola'])
})

test('legacy pending client cards remain visible in Vivir clients and businesses', async () => {
  const pending = { id: request.id, name: 'Solicitud antigua', email: 'legacy@example.com', created_at: request.created_at }
  const mocks = {
    '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
    '@/lib/data/admin': { getAdminClientsPageData: async () => ({ clients: [], editingClient: null, summaries: [], pendingClients: [pending], packsByClient: new Map(), clientsWithServices: new Set() }) },
    '@/lib/platform-requests/admin': { getPendingPlatformRequestCounts: async () => counts },
    '@/lib/actions/admin': { approveClientAction: async () => {}, rejectClientAction: async () => {}, deactivateClientAction: async () => {} },
    '@/components/admin/client-form': { ClientForm: () => null },
  }
  for (const path of [
    'src/app/paneladmin/(protected)/vivir-en-fuengirola/clientes/page.tsx',
    'src/app/paneladmin/(protected)/vivir-en-fuengirola/negocios/page.tsx',
  ]) {
    const Page = loadProjectModule(path, mocks).default
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))
    assert.match(html, /Solicitudes pendientes \(1\)/)
    assert.match(html, /Solicitud antigua/)
  }
})
