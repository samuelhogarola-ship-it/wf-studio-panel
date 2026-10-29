import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { clientId, loadProjectModule } from './helpers/project-harness.mjs'

const client = {
  id: clientId,
  name: 'Ángel',
  company: 'Agama',
  email: 'angel@example.com',
  phone: '600000000',
  status: 'active',
  created_at: '2026-10-01',
}

test('client list exposes one clear action to open the standalone editable record', async () => {
  const Page = loadProjectModule('src/app/paneladmin/(protected)/clientes/page.tsx', {
    '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
    '@/lib/data/admin': { getAdminClientsPageData: async () => ({
      clients: [client], editingClient: null, summaries: [], pendingClients: [],
      packsByClient: new Map(), clientsWithServices: new Set(),
    }) },
    '@/components/admin/client-form': { ClientForm: () => null },
    '@/lib/i18n': { t: (_locale, key) => key },
  }).default

  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))
  const destination = `/paneladmin/clientes/${clientId}`

  assert.equal(html.match(new RegExp(`href="${destination}"`, 'g'))?.length, 2)
  assert.equal(html.match(/Abrir ficha/g)?.length, 1)
  assert.doesNotMatch(html, />Ver<|clients\.list\.edit/)
  assert.doesNotMatch(html, /clientes\?edit=/)
})

test('client record is editable and exposes direct CRM actions without the client list', async () => {
  const Page = loadProjectModule('src/app/paneladmin/(protected)/clientes/[id]/page.tsx', {
    '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
    '@/lib/data/admin': { getAdminClientDetailPageData: async () => ({
      client,
      activePacks: [], packs: [], messages: [], pendingItems: [], recentActivities: [],
    }) },
    '@/lib/actions/admin': { deletePendingItemAction() {}, togglePendingItemStatusAction() {} },
    '@/components/admin/client-form': {
      ClientForm: ({ editingClient }) => React.createElement('div', { 'data-editing-client': editingClient?.id }),
    },
    '@/components/admin/client-message-form': { ClientMessageForm: () => null },
    '@/components/admin/pending-item-form': { PendingItemForm: () => null },
    '@/components/admin/support-preview-form': { SupportPreviewForm: () => null },
    '@/lib/i18n': {
      t: (_locale, key) => key,
      supportPreviewTranslations: { es: { featureDisabled: 'disabled', clientInactive: 'inactive' } },
    },
  }).default

  const html = renderToStaticMarkup(await Page({
    params: Promise.resolve({ id: clientId }),
    searchParams: Promise.resolve({ view: 'profile' }),
  }))

  assert.match(html, new RegExp(`data-editing-client="${clientId}"`))
  assert.match(html, new RegExp(`/paneladmin/facturas\\?new=1&amp;client=${clientId}`))
  assert.match(html, new RegExp(`/paneladmin/servicios\\?new=1&amp;client=${clientId}`))
  assert.match(html, new RegExp(`/paneladmin/bonos\\?new=1&amp;tab=dominios&amp;client=${clientId}`))
  assert.match(html, new RegExp(`/paneladmin/clientes/${clientId}\\?view=messages`))
  assert.match(html, /Volver al resumen/)
  assert.doesNotMatch(html, /Buscar cliente/)
})

test('domain creation opens the domain form with the selected client instead of the hours form', async () => {
  const Page = loadProjectModule('src/app/paneladmin/(protected)/bonos/page.tsx', {
    '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
    '@/lib/data/admin': { getAdminPacksPageData: async (_editingId, typeFilter) => ({
      clients: [client], packs: [], packSummaries: [], editingPack: null, typeFilter,
    }) },
    '@/components/admin/pack-form': {
      PackForm: ({ defaultPackType, defaultClientId }) => React.createElement('div', {
        'data-default-pack-type': defaultPackType,
        'data-default-client-id': defaultClientId,
      }),
    },
    '@/lib/i18n': { t: (_locale, key) => key },
  }).default

  const html = renderToStaticMarkup(await Page({
    searchParams: Promise.resolve({ new: '1', tab: 'dominios', client: clientId }),
  }))

  assert.match(html, /Nuevo dominio/)
  assert.match(html, /data-default-pack-type="domain"/)
  assert.match(html, new RegExp(`data-default-client-id="${clientId}"`))
  assert.doesNotMatch(html, /Nuevo bono de horas/)
})

test('client domain section filters by name and orders the next expiry first', async () => {
  const Page = loadProjectModule('src/app/paneladmin/(protected)/clientes/[id]/page.tsx', {
    '@/lib/auth': { requireAdmin: async () => ({ email: 'admin@example.com' }) },
    '@/lib/data/admin': { getAdminClientDetailPageData: async () => ({
      client,
      activePacks: [
        { id: 'late', client_id: clientId, name: 'late.example', pack_type: 'domain', minutes_total: 0, price: 20, purchase_date: '2026-01-01', renewal_date: '2028-01-01', billing_cycle: 'yearly', paid: true, status: 'active', notes: null, invoice_number: null },
        { id: 'soon', client_id: clientId, name: 'agama.com.mx', pack_type: 'domain', minutes_total: 0, price: 20, purchase_date: '2026-01-01', renewal_date: '2027-01-01', billing_cycle: 'yearly', paid: true, status: 'active', notes: null, invoice_number: null },
      ],
      packs: [], messages: [], pendingItems: [], recentActivities: [],
    }) },
    '@/lib/actions/admin': { deletePendingItemAction() {}, togglePendingItemStatusAction() {} },
    '@/components/admin/client-form': { ClientForm: () => null },
    '@/components/admin/client-message-form': { ClientMessageForm: () => null },
    '@/components/admin/pending-item-form': { PendingItemForm: () => null },
    '@/components/admin/support-preview-form': { SupportPreviewForm: () => null },
    '@/lib/i18n': {
      t: (_locale, key) => key,
      supportPreviewTranslations: { es: { featureDisabled: 'disabled', clientInactive: 'inactive' } },
    },
  }).default

  const html = renderToStaticMarkup(await Page({
    params: Promise.resolve({ id: clientId }),
    searchParams: Promise.resolve({ view: 'domains', domain_q: 'agama' }),
  }))

  assert.match(html, /name="domain_q"/)
  assert.match(html, /agama\.com\.mx/)
  assert.doesNotMatch(html, /late\.example/)
})

test('unknown detail view normalizes to summary and navigation exposes every focused section', () => {
  const { normalizeClientDetailView, ClientDetailNavigation } = loadProjectModule('src/components/admin/client-detail-navigation.tsx')
  assert.equal(normalizeClientDetailView('unexpected'), 'summary')
  const html = renderToStaticMarkup(React.createElement(ClientDetailNavigation, {
    clientId, activeView: 'domains', counts: { domains: 20, invoices: 3 },
  }))
  for (const label of ['Resumen', 'Ficha', 'Acceso', 'Bonos', 'Dominios', 'Hosting', 'Servicios', 'Facturas', 'Gastos', 'Mensajes', 'Historial']) {
    assert.match(html, new RegExp(label))
  }
  assert.match(html, /Volver al resumen/)
  assert.match(html, /view=summary/)
  assert.match(html, />20</)
})
