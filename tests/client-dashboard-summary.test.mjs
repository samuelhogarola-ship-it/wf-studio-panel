import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'

import {
  loadProjectModule,
  database,
  client,
  clientId,
  otherClientId,
} from './helpers/project-harness.mjs'

const componentPath = 'src/components/client/rotating-analytics-summary.tsx'
const scrollResetPath = 'src/components/client/dashboard-scroll-reset.tsx'
const dashboardPath = 'src/app/cliente/(protected)/dashboard/page.tsx'

test('rotator advances after six seconds and manual controls wrap in both directions', () => {
  const { createRotatorState, reduceRotatorState } = loadProjectModule(componentPath)
  const initial = createRotatorState(3, false)

  const early = reduceRotatorState(initial, { type: 'advance', elapsedMs: 5_999, intervalMs: 6_000, itemCount: 3 })
  assert.equal(early.index, 0)
  const advanced = reduceRotatorState(early, { type: 'advance', elapsedMs: 1, intervalMs: 6_000, itemCount: 3 })
  assert.equal(advanced.index, 1)
  assert.equal(reduceRotatorState({ ...advanced, index: 2 }, { type: 'next', itemCount: 3 }).index, 0)
  assert.equal(reduceRotatorState(initial, { type: 'previous', itemCount: 3 }).index, 2)
})

test('rotator pause, reduced motion and zero or one item keep automatic state stable', () => {
  const { createRotatorState, getRotationControlState, reduceRotatorState } = loadProjectModule(componentPath)
  const reduced = createRotatorState(3, true)
  assert.equal(reduced.reducedMotion, true)
  assert.equal(reduceRotatorState(reduced, { type: 'advance', elapsedMs: 6_000, intervalMs: 6_000, itemCount: 3 }).index, 0)
  assert.deepEqual(getRotationControlState(reduced), {
    disabled: true,
    label: 'Rotación desactivada por movimiento reducido',
    text: 'Movimiento reducido',
  })

  const paused = reduceRotatorState(createRotatorState(3, false), { type: 'set-manual-paused', paused: true })
  assert.deepEqual(getRotationControlState(paused), {
    disabled: false,
    label: 'Reanudar rotación',
    text: 'Reanudar',
  })
  assert.equal(reduceRotatorState(paused, { type: 'advance', elapsedMs: 12_000, intervalMs: 6_000, itemCount: 3 }).index, 0)
  for (const itemCount of [0, 1]) {
    const state = createRotatorState(itemCount, false)
    assert.equal(reduceRotatorState(state, { type: 'advance', elapsedMs: 12_000, intervalMs: 6_000, itemCount }).index, 0)
    assert.equal(reduceRotatorState(state, { type: 'next', itemCount }).index, 0)
    assert.equal(reduceRotatorState(state, { type: 'previous', itemCount }).index, 0)
  }
})

test('rotator stays paused until both hover and focus have ended', () => {
  const { createRotatorState, reduceRotatorState } = loadProjectModule(componentPath)
  const advance = { type: 'advance', elapsedMs: 6_000, intervalMs: 6_000, itemCount: 3 }
  const initial = createRotatorState(3, false)

  const focusedWhileHovered = reduceRotatorState(
    reduceRotatorState(initial, { type: 'set-hover-paused', paused: true }),
    { type: 'set-focus-paused', paused: true },
  )
  const pointerLeft = reduceRotatorState(focusedWhileHovered, { type: 'set-hover-paused', paused: false })
  assert.equal(reduceRotatorState(pointerLeft, advance).index, 0)
  assert.equal(reduceRotatorState(
    reduceRotatorState(pointerLeft, { type: 'set-focus-paused', paused: false }),
    advance,
  ).index, 1)

  const pointerRemains = reduceRotatorState(focusedWhileHovered, { type: 'set-focus-paused', paused: false })
  assert.equal(reduceRotatorState(pointerRemains, advance).index, 0)
  assert.equal(reduceRotatorState(
    reduceRotatorState(pointerRemains, { type: 'set-hover-paused', paused: false }),
    advance,
  ).index, 1)
})

test('analytics summary renders one public metric with accessible controls and an authorized route', () => {
  const { RotatingAnalyticsSummary } = loadProjectModule(componentPath)
  const html = renderToStaticMarkup(React.createElement(RotatingAnalyticsSummary, {
    intervalMs: 6_000,
    locale: 'en',
    summaries: [{
      projectSlug: 'sportmassagefuengirola',
      projectName: 'Sport Massage',
      pageviews: 120,
      visitors: 80,
      visits: 95,
      languages: [
        { code: 'es', label: 'Español', value: 60, color: '#ef4444' },
        { code: 'en', label: 'English', value: 30, color: '#22c55e' },
        { code: 'fi', label: 'Suomi', value: 10, color: '#3b82f6' },
      ],
    }],
  }))

  assert.match(html, /Sport Massage/)
  assert.match(html, /Page views/)
  assert.match(html, />120</)
  assert.match(html, /href="\/cliente\/proyectos\/sportmassagefuengirola\/estadisticas"/)
  assert.match(html, /Traffic by page language/)
  assert.match(html, /Based on the language version recorded by the website\./)
  assert.match(html, /Spanish[^]*60/)
  assert.match(html, /English[^]*30/)
  assert.match(html, /Finnish[^]*10/)
  assert.match(html, /background-color:#ef4444[^]*width:60%/)
  assert.match(html, /background-color:#22c55e[^]*width:30%/)
  assert.match(html, /background-color:#3b82f6[^]*width:10%/)
  for (const label of ['Previous metric', 'Pause rotation', 'Next metric']) {
    assert.match(html, new RegExp(`aria-label="${label}"`))
  }
  assert.doesNotMatch(html, /registry|UMAMI|credential|endpoint/i)
})

test('analytics language diagram keeps an honest empty state', () => {
  const { RotatingAnalyticsSummary } = loadProjectModule(componentPath)
  const html = renderToStaticMarkup(React.createElement(RotatingAnalyticsSummary, {
    summaries: [{
      projectSlug: 'mi-web', projectName: 'Mi Web', pageviews: 1, visitors: 1, visits: 1, languages: [],
    }],
  }))

  assert.match(html, /Todavía no hay datos del idioma de las páginas/)
})

test('dashboard scroll reset keeps a 390px post-login viewport at the top after restoration', async () => {
  const previousWindow = globalThis.window
  const previousDocument = globalThis.document
  const previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://portal.example.test/cliente/dashboard' })
  Object.defineProperty(dom.window, 'innerWidth', { configurable: true, value: 390 })
  const calls = []
  dom.window.scrollTo = (...args) => calls.push(args)
  let animationFrame
  dom.window.requestAnimationFrame = (callback) => {
    animationFrame = callback
    return 7
  }
  dom.window.cancelAnimationFrame = () => {}
  dom.window.matchMedia = (query) => ({
    matches: query === '(max-width: 1023px)',
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false },
  })

  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true

  try {
    const { DashboardScrollReset } = loadProjectModule(scrollResetPath)
    const root = createRoot(dom.window.document.getElementById('root'))
    await act(async () => root.render(React.createElement(DashboardScrollReset)))
    assert.deepEqual(calls, [[0, 0]])
    await act(async () => animationFrame())
    assert.deepEqual(calls, [[0, 0], [0, 0]])
    await act(async () => root.unmount())
  } finally {
    globalThis.window = previousWindow
    globalThis.document = previousDocument
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment
    dom.window.close()
  }
})

test('Sport Massage dashboard passes its forced English locale to analytics', async () => {
  let localeReads = 0
  const Page = loadProjectModule(dashboardPath, {
    '@/lib/data/projects': {
      getClientPortalContext: async () => ({
        client,
        projects: [{ slug: 'sportmassagefuengirola', domain: 'sportmassagefuengirola.com' }],
      }),
    },
    '@/lib/data/client': {
      getClientDashboardData: async () => ({
        notifications: [], messages: [], reports: [], closedPacks: [], pendingItems: [],
        hoursPacks: [], activities: [], summaryMap: new Map(), unreadMessageCount: 0,
      }),
      getClientFacturasData: async () => [],
    },
    '@/lib/analytics/client-summary': { getClientAnalyticsSummaries: async () => [] },
    '@/lib/locale': { getLocale: async () => { localeReads += 1; return 'es' } },
    '@/components/client/rotating-analytics-summary': {
      RotatingAnalyticsSummary: ({ locale }) => React.createElement('section', { 'data-analytics-locale': locale }),
    },
    '@/components/client/dashboard-scroll-reset': { DashboardScrollReset: () => null },
  }).default

  const html = renderToStaticMarkup(await Page())

  assert.match(html, /data-analytics-locale="en"/)
  for (const value of ['Hello, Ana', 'Updates', 'Messages', 'Reports', 'No active services yet.', 'Recent activity']) {
    assert.match(html, new RegExp(value.replace('.', '\\.')))
  }
  assert.doesNotMatch(html, /Hola,|Novedades|Mensajes|Informes|Actividad reciente/)
  assert.equal(localeReads, 0)
})

test('shared dashboard keeps existing content and separates notifications, messages and reports', async () => {
  const ownedNotification = { id: 'n-owned', client_id: clientId, title: 'Nueva entrega', body: 'Trabajo publicado', minutes_delta: null, remaining_minutes: null, created_at: '2026-10-21T10:00:00Z' }
  const foreignNotification = { ...ownedNotification, id: 'n-foreign', client_id: otherClientId, title: 'Foreign notice' }
  const ownedMessage = { id: 'm-owned', client_id: clientId, subject: 'Mensaje privado', body: 'Solo para Ana', direction: 'inbound', type: 'message', read_at: null, reply_to_id: null, created_at: '2026-10-21T11:00:00Z' }
  const foreignMessage = { ...ownedMessage, id: 'm-foreign', client_id: otherClientId, subject: 'Foreign message' }
  const ownedReport = { id: 'r-owned', client_id: clientId, kind: 'report', title: 'Informe mensual', body: '', report_path: '/informes/mensual', storage_path: null, content_type: null, created_by: null, created_at: '2026-10-20T10:00:00Z' }
  const foreignReport = { ...ownedReport, id: 'r-foreign', client_id: otherClientId, title: 'Foreign report' }
  const db = database({
    packs: [], pack_summary: [], activities: [], invoices: [], pending_items: [],
    notifications: [ownedNotification, foreignNotification],
    messages: [ownedMessage, foreignMessage],
    client_resources: [ownedReport, foreignReport],
  })
  const mocks = {
    '@/lib/data/projects': {
      getClientPortalContext: async () => ({
        userId: 'session-client', email: client.email, role: 'client', client,
        mode: 'legacy', projects: [], navigation: [],
      }),
      getCapabilityConfigurationIssue: () => null,
    },
    '@/lib/auth': { requireClientAccess: async () => ({ userId: 'session-client', email: client.email, role: 'client', client }) },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => db },
    '@/components/client/dashboard-scroll-reset': {
      DashboardScrollReset: () => React.createElement('span', { 'data-dashboard-scroll-reset': 'mounted' }),
    },
  }
  const Page = loadProjectModule(dashboardPath, mocks).default
  const html = renderToStaticMarkup(await Page())

  for (const value of ['Hola, Ana', 'Novedades', 'Nueva entrega', 'Estadísticas', 'Mensajes', 'Mensaje privado', 'Informes', 'Informe mensual', 'Actividad reciente']) {
    assert.match(html, new RegExp(value))
  }
  assert.match(html, /data-dashboard-scroll-reset="mounted"/)
  for (const href of ['/cliente/mensajeria', '/cliente/informes', '/cliente/servicios?new=1']) {
    assert.match(html, new RegExp(`href="${href.replace('?', '\\?')}"`))
  }
  assert.doesNotMatch(html, /Foreign notice|Foreign message|Foreign report/)

  for (const table of ['notifications', 'messages', 'client_resources']) {
    const call = db.calls.find(entry => entry.table === table)
    assert.ok(call, `${table} must be queried`)
  }
})

test('dashboard reports the exact unread total beyond its five-message preview', async () => {
  const messages = Array.from({ length: 7 }, (_, index) => ({
    id: `message-${index}`,
    client_id: clientId,
    subject: `Mensaje ${index}`,
    body: `Contenido ${index}`,
    direction: 'inbound',
    type: 'message',
    read_at: null,
    reply_to_id: null,
    created_at: `2026-10-${String(10 + index).padStart(2, '0')}T11:00:00Z`,
  }))
  const db = database({
    packs: [], pack_summary: [], activities: [], invoices: [], pending_items: [],
    notifications: [], messages, client_resources: [],
  })
  const Page = loadProjectModule(dashboardPath, {
    '@/lib/data/projects': {
      getClientPortalContext: async () => ({
        userId: 'session-client', email: client.email, role: 'client', client,
        mode: 'legacy', projects: [], navigation: [],
      }),
      getCapabilityConfigurationIssue: () => null,
    },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => db },
  }).default

  const html = renderToStaticMarkup(await Page())

  assert.match(html, /7 sin leer/)
  const messageCalls = db.calls.filter((call) => call.table === 'messages')
  assert.equal(messageCalls.length, 2)
  assert.ok(messageCalls.some((call) => call.columns === 'id'))
})

test('rendering received messages preserves unread state in support but marks it read for a real client', async () => {
  const unread = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    subject: 'Pendiente de leer',
    body: 'Contenido',
    direction: 'inbound',
    type: 'message',
    read_at: null,
    reply_to_id: null,
    created_at: '2026-10-23T10:00:00.000Z',
  }
  for (const mode of ['support', 'client']) {
    const calls = []
    const composerProps = []
    const Page = loadProjectModule('src/app/cliente/(protected)/mensajeria/page.tsx', {
      '@/lib/support/portal-viewer': {
        requirePortalViewer: async () => ({
          mode,
          identity: { userId: mode === 'client' ? 'client-user' : 'admin-user', email: client.email, role: mode === 'client' ? 'client' : 'admin', client },
          client,
        }),
      },
      '@/lib/data/client': {
        getClientMessages: async () => [structuredClone(unread)],
        getClientPendingItems: async () => [],
        markClientInboundMessagesRead: async (resolvedClientId, ids) => {
          calls.push({ resolvedClientId, ids })
          return '2026-10-23T10:01:00.000Z'
        },
      },
      '@/components/client/message-composer': { MessageComposer: props => { composerProps.push(props); return React.createElement('form') } },
    }).default

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ tab: 'recibidos', new: '1' }) }))

    assert.match(html, /Pendiente de leer/)
    assert.deepEqual(calls, mode === 'client' ? [{ resolvedClientId: clientId, ids: [unread.id] }] : [])
    assert.equal(html.includes('bg-brand/5'), mode === 'support')
    assert.equal(composerProps[0].readOnly, mode === 'support')
  }
})
