import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  loadProjectModule,
  database,
  client,
  clientId,
  otherClientId,
} from './helpers/project-harness.mjs'

const componentPath = 'src/components/client/rotating-analytics-summary.tsx'
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
  const { createRotatorState, reduceRotatorState } = loadProjectModule(componentPath)
  const reduced = createRotatorState(3, true)
  assert.equal(reduced.reducedMotion, true)
  assert.equal(reduceRotatorState(reduced, { type: 'advance', elapsedMs: 6_000, intervalMs: 6_000, itemCount: 3 }).index, 0)

  const paused = reduceRotatorState(createRotatorState(3, false), { type: 'set-manual-paused', paused: true })
  assert.equal(reduceRotatorState(paused, { type: 'advance', elapsedMs: 12_000, intervalMs: 6_000, itemCount: 3 }).index, 0)
  for (const itemCount of [0, 1]) {
    const state = createRotatorState(itemCount, false)
    assert.equal(reduceRotatorState(state, { type: 'advance', elapsedMs: 12_000, intervalMs: 6_000, itemCount }).index, 0)
    assert.equal(reduceRotatorState(state, { type: 'next', itemCount }).index, 0)
    assert.equal(reduceRotatorState(state, { type: 'previous', itemCount }).index, 0)
  }
})

test('analytics summary renders one public metric with accessible controls and an authorized route', () => {
  const { RotatingAnalyticsSummary } = loadProjectModule(componentPath)
  const html = renderToStaticMarkup(React.createElement(RotatingAnalyticsSummary, {
    intervalMs: 6_000,
    summaries: [{ projectSlug: 'mi-web', projectName: 'Mi Web', pageviews: 120, visitors: 80, visits: 95 }],
  }))

  assert.match(html, /Mi Web/)
  assert.match(html, /Páginas vistas/)
  assert.match(html, />120</)
  assert.match(html, /href="\/cliente\/proyectos\/mi-web\/estadisticas"/)
  for (const label of ['Métrica anterior', 'Pausar rotación', 'Métrica siguiente']) {
    assert.match(html, new RegExp(`aria-label="${label}"`))
  }
  assert.doesNotMatch(html, /registry|UMAMI|credential|endpoint/i)
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
  }
  const Page = loadProjectModule(dashboardPath, mocks).default
  const html = renderToStaticMarkup(await Page())

  for (const value of ['Hola, Ana', 'Novedades', 'Nueva entrega', 'Estadísticas', 'Mensajes', 'Mensaje privado', 'Informes', 'Informe mensual', 'Actividad reciente']) {
    assert.match(html, new RegExp(value))
  }
  for (const href of ['/cliente/mensajeria', '/cliente/informes', '/cliente/servicios?new=1']) {
    assert.match(html, new RegExp(`href="${href.replace('?', '\\?')}"`))
  }
  assert.doesNotMatch(html, /Foreign notice|Foreign message|Foreign report/)

  for (const table of ['notifications', 'messages', 'client_resources']) {
    const call = db.calls.find(entry => entry.table === table)
    assert.ok(call, `${table} must be queried`)
  }
})
